---
title: "数据校验"
tags:
  - "后端"
  - "go"
  - "gin"
  - "笔记"
category: "后端"
folder: "Gin"
parent: "[[后端/Gin/中间件]]"
related:
  - "[[后端/Gin/请求参数与数据绑定]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 数据校验

Gin 内置使用 [go-playground/validator/v10](https://github.com/go-playground/validator) 进行数据校验。通过结构体的 `binding` tag 定义校验规则，在 `ShouldBind` 时自动触发校验。

## 常用校验规则（binding tag）

| 规则 | 说明 | 示例 |
|------|------|------|
| `required` | 必填 | `binding:"required"` |
| `min`/`max` | 最小/最大长度（字符串）或值（数字） | `binding:"min=3,max=20"` |
| `len` | 长度 | `binding:"len=11"` |
| `eq`/`ne` | 等于/不等于 | `binding:"eq=10"` |
| `gt`/`gte`/`lt`/`lte` | 大于/大于等于/小于/小于等于 | `binding:"gte=0,lte=120"` |
| `oneof` | 枚举值 | `binding:"oneof=male female"` |
| `email` | 邮箱格式 | `binding:"email"` |
| `url` | URL 格式 | `binding:"url"` |
| `ip` | IP 地址 | `binding:"ip"` |
| `uuid` | UUID 格式 | `binding:"uuid"` |
| `datetime` | 时间格式 | `binding:"datetime=2006-01-02"` |
| `omitempty` | 空值跳过校验 | `binding:"omitempty,email"` |

## 基础校验示例

~~~go
type RegisterReq struct {
	Username string `json:"username" binding:"required,min=3,max=20"`
	Password string `json:"password" binding:"required,min=6,max=20"`
	Email    string `json:"email" binding:"required,email"`
	Age      int    `json:"age" binding:"gte=1,lte=120"`
	Gender   string `json:"gender" binding:"required,oneof=male female"`
}

r.POST("/register", func(c *gin.Context) {
	var req RegisterReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"msg": "注册成功", "user": req.Username})
})
~~~

校验失败时 `err` 是 `validator.ValidationErrors` 类型，包含每个字段的校验失败信息。

## omitempty 与条件校验

`omitempty` 表示字段为空时跳过校验，常用于可选字段：

~~~go
type UpdateReq struct {
	Email string `json:"email" binding:"omitempty,email"`   // 可选，填了必须是邮箱
	Phone string `json:"phone" binding:"omitempty,len=11"`  // 可选，填了长度必须11
}
~~~

## 自定义校验器

注册自定义校验规则：

~~~go
func main() {
	r := gin.Default()

	// 获取 gin 绑定引擎中的 validator 实例
	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		// 注册自定义校验函数：校验日期格式 YYYY-MM-DD
		_ = v.RegisterValidation("dateformat", func(fl validator.FieldLevel) bool {
			_, err := time.Parse("2006-01-02", fl.Field().String())
			return err == nil
		})
	}

	r.POST("/date", func(c *gin.Context) {
		var req struct {
			Date string `json:"date" binding:"required,dateformat"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}
		c.JSON(200, gin.H{"date": req.Date})
	})

	r.Run()
}
~~~

## 结构体级别校验

当字段间存在依赖关系（如密码与确认密码一致），使用 `RegisterStructValidation`：

~~~go
type ChangePwdReq struct {
	Password  string `json:"password" binding:"required"`
	ConfirmPwd string `json:"confirm_pwd" binding:"required"`
}

func ValidateChangePwd(sl validator.StructLevel) {
	req := sl.Current().Interface().(ChangePwdReq)
	if req.Password != req.ConfirmPwd {
		sl.ReportError(req.ConfirmPwd, "ConfirmPwd", "confirm_pwd", "eqfield", "")
	}
}

func main() {
	r := gin.Default()
	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		v.RegisterStructValidation(ValidateChangePwd, ChangePwdReq{})
	}
	// ...
}
~~~

## 友好的错误信息

默认的校验错误信息是英文且较晦涩。可以将错误转换为更友好的中文提示：

~~~go
func GetValidMsg(err error) map[string]string {
	errs := make(map[string]string)
	if ve, ok := err.(validator.ValidationErrors); ok {
		for _, e := range ve {
			field := e.Field()
			tag := e.Tag()
			switch tag {
			case "required":
				errs[field] = field + " 不能为空"
			case "min":
				errs[field] = field + " 长度不能小于 " + e.Param()
			case "max":
				errs[field] = field + " 长度不能大于 " + e.Param()
			case "email":
				errs[field] = field + " 格式不正确"
			default:
				errs[field] = field + " 校验失败: " + tag
			}
		}
	}
	return errs
}

r.POST("/login", func(c *gin.Context) {
	var req Login
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"errors": GetValidMsg(err)})
		return
	}
	c.JSON(200, gin.H{"msg": "ok"})
})
~~~

::: tip
生产环境推荐使用 [go-playground/universal-translator](https://github.com/go-playground/universal-translator) 配合 `zh` 语言包，自动翻译校验错误为中文。
:::

## 翻译校验错误为中文（推荐方案）

~~~go
import (
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/locales/zh"
	ut "github.com/go-playground/universal-translator"
	"github.com/go-playground/validator/v10"
	zhTrans "github.com/go-playground/validator/v10/translations/zh"
)

var trans ut.Translator

func InitTrans() {
	uni := ut.New(zh.New())
	trans, _ = uni.GetTranslator("zh")
	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		_ = zhTrans.RegisterDefaultTranslations(v, trans)
	}
}

// 使用：errs.Translate(trans) 返回中文错误 map
~~~
