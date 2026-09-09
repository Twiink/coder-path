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
func test () int &#123;
	defer func() &#123;
		err := recover()
		if err != nil &#123;
			fmt.Println(err)
		&#125;
	&#125;()
	num1 := 100
	num2 :=0
	num3 := num1 / num2
	return num3
&#125;

func main()  &#123;

	test := test()

	fmt.Printf("123456")
	fmt.Println(test)
&#125;
~~~

**自定义错误**

1. errors.New("错误说明"), 返回error类型的值为一个错误

2. panic内置函数, 接收一个interface()类型的值, 可接收error类型变量，输出错误信息并退出程序：
	~~~go
	func read(name string) (err error)  &#123;
		if name == "config" &#123;
			return nil
		&#125;else &#123;
			return errors.New("文件错误")
		&#125;
	&#125;
	func test2()  &#123;
		err := read("config1")
		if err != nil &#123;
			panic(err)
		&#125;
		fmt.Println("正常执行")
	&#125;
	func main()  &#123;
		test2()
	&#125;
	~~~
