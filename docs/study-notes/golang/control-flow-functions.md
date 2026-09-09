---
title: "流程控制与函数"
tags:
  - "后端"
  - "go"
  - "笔记"
category: "后端"
folder: "Go"
parent: "[[后端/Go/基础类型与常量指针]]"
related:
  - "[[后端/Go/错误处理]]"
  - "[[目录]]"
created: 2025-12-06
updated: 2026-09-06
---

# 流程控制与函数

## 流程控制
~~~go
if a < 10 &#123;

&#125;
//if语句判断不需要小括号
if b := 1; b < 10 &#123;  

&#125;
//if判断中可以直接定义变量
~~~
~~~go
switch score := 30; &#123;
    case "a":
    fmt.Println("a")
    case "b":
    fmt.Println("b")
    case "c", "d":
    fmt.Println("c", "d")
	case score > 20 $$ score < 50:
    fmt.Println("判断")
    fallthrough
    case:
    fmt.Println("0")
    default:
    fmt,Println("以上都不匹配,默认输出")
&#125;
//不需要break, case后面可以带多个表达式用逗号分隔
//case后面也可不带表达式, 也可以直接定义变量, 不推荐
//fallthrough穿透: 当前case成立,仍执行后面的case,只穿透一层
~~~
~~~go
for i := 1; i <= 10;i++ &#123;

&#125;
//传统循环,不需要小括号
//如果字符串含中文循环出来会乱码,按字节来遍历的,转为切片可解决
for index, value := range str &#123;
    
&#125;
//for-range默认按字符方式遍历
~~~
~~~go
lable2:
for i := 0;i < 4;i++ &#123;
    label1:
    for j := 0;j < 10;j++ &#123;
        if j == 2 &#123;
            break label1
        &#125;
        fmt.Println("123")
    &#125;
&#125;
//break默认会跳出最近的循环
//当指定跳出的标签时,会跳出标签层对应的for循环
~~~
~~~go
lable2:
for i := 0;i < 4;i++ &#123;
    label1:
    for j := 0;j < 10;j++ &#123;
        if j == 2 &#123;
            continue label1
        &#125;
        fmt.Println("123")
    &#125;
&#125;
//continue默认结束当前最近的循环,执行下次循环
//当指定跳出的标签时,会结束标签层对应的当前循环,执行下次循环
~~~
~~~go
fmt.Println("1")
goto label
fmt.Println("2")
fmt.Println("3")
fmt.Println("4")
fmt.Println("5")
label:
fmt.Println("6")
//goto语句指定标签,直接跳到标签处执行代码,不建议使用该语句
//通常与if语句一起使用
~~~
## 函数
- 返回值支持命名和多个

~~~go
//定义函数类型
type myFunc func(int, int ) int
//定义函数
func getSun(num1 int, num2 int) int &#123;
	return num1 + num2
&#125;
//定义传函数参数的函数
func myFunc2(funvar myFunc, num1 int, num2 int) int  &#123;
	return funvar(num1, num2)
&#125;
//在main中使用
func main() &#123;
	res3 := myFunc2(getSun, 500, 500)
	fmt.Println(res3)
&#125;
~~~
~~~go
func myfunc(args... int) (i int, o int) &#123;
    num := 1
    for a :=0; a<len(args); a++&#123;
       num += args[a]
    &#125; 
    return num, a
&#125;
//args...代表传进来的多个参数,类型是切片
~~~
~~~go
var abc int = 567
func init()&#123;
    res := 123
    defer fmt.Println(res)	//123
    res++
&#125;
func main()&#123;
    
&#125;
//defer后面的代码会推入栈中等待函数执行完后再执行,并拷贝引用的值
//在全局中,go语言会依次解析全局变量->init初始化函数->main主函数
~~~

## 常用函数

字符串：
~~~go
len(str)					
//返回变量的长度, 内置函数(无需引包)
~~~
~~~go
[]rune(str)
//转为切片并返回, 内置函数(无需引包), 解决遍历字符串出现乱码的问题.
~~~
~~~go
strconv.Atoi("123")
//有两个返回值: value和error
//字符串转整数并返回, 需要引包, 只能转数字字符串, 否则返回的为nil零值
~~~
~~~go
strconv.Itoa(123)
//整数转字符串并返回, 需要引包
~~~
~~~go
**[]byte("hello")**
//字符串转byte切片并返回ascll码值
~~~
~~~go
string([]byte&#123;97,98,99&#125;)
//将byte切片转为字符串并返回, 内置函数
~~~
~~~go
strconv.FormatInt(123, 2)
//10进制转其他进制并返回
~~~
~~~go
strings.Contains("hello", "he")
//查找子字符串是否在指定的字符串中, 返回布尔值, 需要引包
~~~
~~~go
strings.Count("ababa", "ab")
//统计子字符串在指定的字符串中有多少个并返回, 需要引包
~~~
~~~go
strings.EqualFold("abc", "ABC")
//字符串比较, 不区分大小写(==是区分大小写), 返回布尔值, 需要引包
~~~
~~~go
strings.Index("abc", "b")
//返回子字符串在指定字符串中第一次出现的值的索引值, 需要引包
~~~
~~~go
strings.LastIndex("abc", "b")
//返回子字符串在指定字符串中最后一次出现的值的索引值, 需要引包
~~~
~~~go
strings.Replace("gogohello", "go", "ios", -1)
//指定初始字符串, 要替换的位置子串, 替换后的子串, 替换次数
//-1为替换所有匹配的子串, 不改变初始字符串, 返回替换后的新字符串
~~~
~~~go
strings.Split("go,go,hello",  ",")
//按照指定的字符分割字符串,返回一个包含分割后的多个字符串的数组
//不会改变初始字符串本身
~~~
~~~go
strings.ToLower("Go")
//字符串转小写并返回, 不改变字符串本身
~~~
~~~go
strings.ToUpper("Go")
//字符串转大写并返回, 不改变字符串本身
~~~
~~~go
strings.TrimSpace(" gao ")
//去除字符串两端空格并返回, 不改变字符串本身
~~~
~~~go
strings.Trim("!gao!", "!")
//去掉字符串两端指定的字符并返回, 不改变字符串本身
~~~
~~~go
strings.TrimLeft("!gao", "!")
//去掉字符串左边指定的字符并返回, 不改变字符串本身
~~~
~~~go
strings.TrimRight("gao!", "!")
//去掉字符串右边指定的字符并返回, 不改变字符串本身
~~~
~~~go
strings.HasPrefix("!gao", "!")
//判断字符串是否以指定的字符开头并返回布尔值
~~~
~~~go
strings.HasSuffix("gao!", "!")
//判断字符串是否以指定的字符结束并返回布尔值
~~~
时间日期：
~~~go
now := time.Now()
//获取当前时间并返回
~~~
~~~go
now.Year()
// 获取年
~~~
~~~go
int(now.Month())
// 获取月
~~~
~~~go
now.Day()
// 获取日期
~~~
~~~go
now.Hour()
// 获取小时
~~~
~~~go
now.Minute()
// 获取分钟
~~~
~~~go
now.Second()
// 获取秒
~~~
~~~go
now.Format("2006-01-02 15:04:05")
//格式化日期时间
~~~
~~~go
type Duration int64
const (
	Nanosecond Duration = 1						//纳秒
	Microsecond 		= 1000 * Nanosecond		//微秒
	Millisecond			= 1000 * Microsecond	//毫秒
	Second				= 1000 * Millisecond	//秒
	Minute				= 60 * Second			//分
	Hour				= 60 * Minute			//时
)
// 内置的时间常量
~~~
~~~go
time.Sleep()
//休眠即延迟执行, 可使用时间常量来计算需要休眠的时间 
~~~
~~~go
now.Unix()
//获取1970年到现在的秒数时间戳
~~~
~~~go
now.UnixNano()
//获取1970年到现在的纳秒数时间戳
~~~

## 变量初始化函数
~~~go
new()
//传入一个值类型, 创建一个指针, 系统分配指针的地址值以及自身的地址
//指针的地址值的值为传入值类型的零值
~~~
~~~go
make()
//传入一个引用类型, 创建一个指针, 系统分配指针的地址值以及自身的地址
//指针的地址值的值为传入引用类型的零值
~~~
