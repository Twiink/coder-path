---
title: "并发编程"
tags:
  - "后端"
  - "go"
  - "笔记"
category: "后端"
folder: "Go"
parent: "[[后端/Go/接口]]"
related:
  - "[[后端/Go/文件操作]]"
  - "[[后端/Go/网络编程与并发模型]]"
  - "[[目录]]"
created: 2025-12-06
updated: 2026-09-06
---

# 并发编程（协程与管道）

## 协程

通过go关键字启动协程

协程依赖于系统内核

协程是主线程的分支, 依赖于主线程, 若主线程执行完成, 协程会自动结束

## 管道
- 先进先出
- 遍历管道需使用 `for range`
- 容量固定, 需要用 `make` 声明再使用
- 管道只读: `var Chan <-  chan int`
- 管道只写: `var Chan chan <-  int`
- `select case`语法解决管道阻塞问题

协程与管道案例

~~~go
func putNum(iniChan chan int) &#123;
	for i:=0;i<=8000;i++ &#123;
		iniChan<-i
	&#125;
	close(iniChan)
&#125;
func primeChan (intChan chan int, primeChan chan int, exitChan chan bool) &#123;
	//var num int
	var flag bool
	for &#123;
		num, ok := <-intChan
		if !ok &#123;
			break
		&#125;
		flag = true
		for i := 2; i < num; i++ &#123;
			if num % i == 0 &#123;
				flag = false
				break
			&#125;
		&#125;
		if flag &#123;
			primeChan<- num
		&#125;
	&#125;
	exitChan<-true
&#125;

func main() &#123;
	iniChan := make(chan int, 1000)
	promeChan := make(chan int, 2000)
	exitChan := make(chan bool, 4)
	go putNum(iniChan)
	for i := 0; i < 4; i++ &#123;
		go primeChan(iniChan, promeChan, exitChan)
	&#125;
	go func() &#123;

		for i := 0; i < 4; i++ &#123;
			<-exitChan
		&#125;
		close(promeChan)

	&#125;()
	for &#123;
		res, ok :=<-promeChan
		if !ok &#123;
			break
		&#125;
		fmt.Printf("s=%d\n", res)
	&#125;
&#125;
~~~
