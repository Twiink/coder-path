---
title: "错误处理"
tags:
  - "后端"
  - "go"
  - "笔记"
category: "后端"
folder: "Go"
parent: "[[后端/Go/流程控制与函数]]"
related:
  - "[[后端/Go/结构体与Map]]"
  - "[[目录]]"
created: 2025-12-06
updated: 2026-09-06
---

# 错误处理
- defer
- panic
- recover

Go中抛出一个panic异常,然后在defer中通过recover捕获, 然后正常处理：
~~~go
func test () int {
	defer func() {
		err := recover()
		if err != nil {
			fmt.Println(err)
		}
	}()
	num1 := 100
	num2 :=0
	num3 := num1 / num2
	return num3
}

func main()  {

	test := test()

	fmt.Printf("123456")
	fmt.Println(test)
}
~~~

**自定义错误**

1. errors.New("错误说明"), 返回error类型的值为一个错误

2. panic内置函数, 接收一个interface()类型的值, 可接收error类型变量，输出错误信息并退出程序：
	~~~go
	func read(name string) (err error)  {
		if name == "config" {
			return nil
		}else {
			return errors.New("文件错误")
		}
	}
	func test2()  {
		err := read("config1")
		if err != nil {
			panic(err)
		}
		fmt.Println("正常执行")
	}
	func main()  {
		test2()
	}
	~~~
