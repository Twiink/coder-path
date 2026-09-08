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
func putNum(iniChan chan int) {
	for i:=0;i<=8000;i++ {
		iniChan<-i
	}
	close(iniChan)
}
func primeChan (intChan chan int, primeChan chan int, exitChan chan bool) {
	//var num int
	var flag bool
	for {
		num, ok := <-intChan
		if !ok {
			break
		}
		flag = true
		for i := 2; i < num; i++ {
			if num % i == 0 {
				flag = false
				break
			}
		}
		if flag {
			primeChan<- num
		}
	}
	exitChan<-true
}

func main() {
	iniChan := make(chan int, 1000)
	promeChan := make(chan int, 2000)
	exitChan := make(chan bool, 4)
	go putNum(iniChan)
	for i := 0; i < 4; i++ {
		go primeChan(iniChan, promeChan, exitChan)
	}
	go func() {

		for i := 0; i < 4; i++ {
			<-exitChan
		}
		close(promeChan)

	}()
	for {
		res, ok :=<-promeChan
		if !ok {
			break
		}
		fmt.Printf("s=%d\n", res)
	}
}
~~~
