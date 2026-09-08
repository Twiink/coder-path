---
title: "文件操作"
tags:
  - "后端"
  - "go"
  - "笔记"
category: "后端"
folder: "Go"
parent: "[[后端/Go/并发编程]]"
related:
  - "[[后端/Go/泛型]]"
  - "[[目录]]"
created: 2025-12-06
updated: 2026-09-06
---

# 文件操作
`os.Create`: 文件不存在则创建, 文件存在则清空文件内容
~~~go
func main () {
	f, err := os.Create('./test/is')
	if err != nil {
		fmt.Println("create err:", err)
		return
	}
	defer f.Close()		//关闭文件
}
~~~
`os.Open`: 以只读方式打开文件,文件不存在则打开失败
~~~go
func main () {
	f, err := os.Open('./test/is')
	if err != nil {
		fmt.Println("create err:", err)
		return
	}
	_, err := f.WriteString("高江华")
	if err != nil {
		fmt.Println("WriteString err:", err)
		return
	}					//会报错,权限不足
	defer f.Close()		//关闭文件
}
~~~
`os.OpenFile`: (适用于操作目录) 以只读, 只写, 读写方式打开文件, 文件不存在则打开失败

参数1: 文件名

参数2:
- O_RDONLY		只读
- O_WRONLY       只写
- O_RDWR            读写

参数3: ( 对于目录传: os.ModeDir )
1. 没有任何权限
2. 执行权限 ( 如果是可执行文件, 是可以运行的 )
3. 写权限
4. 写权限与执行权限
5. 读权限
6. 读权限与执行权限
7. 读权限与写权限
8. 读权限, 写权限, 执行权限
~~~go
func main () {
	f, err := os.OpenFile('./test/is', O_RDWR, 6)
	if err != nil {
		fmt.Println("create err:", err)
		return
	}
	_, err := f.WriteString("高江华")
	if err != nil {
		fmt.Println("WriteString err:", err)
		return
	}
	defer f.Close()		//关闭文件
}
~~~
- `f.WriteString()`: 返回写入的字符个数, 从起始位置开始, 会覆盖原有内容

- `f.Seek()`: 修改文件的读写指针位置

	- 参数1: 偏移量
    	- 正: 向文件尾部偏移
    	- 负: 向文件头部偏移
  
	- 参数2: 偏移起始位置
    	- `io.SeekStart`: 文件起始位置
    	- `io.SeekCurrent`: 文件当前位置
        - `io.SeekEnd`: 文件结尾位置

- `f.WriteAt()`: 在文件指定偏移位置, 写入`[]byte`, 通常搭配`Seek()`
  - 参数1:	待写入的数据
  - 参数2:	偏移量

创建带缓冲区的读取器
~~~go
reader := bufio.NewReader(f) 	//创建一个带有缓冲区的reader
buf, err := reader.ReadBytes('\n')		//到\n结束,读一行数据
if err != nil {			//err == io.EOF则读完所有内容
	fmt.Println("ReadBytes err:", err)
	return
}
fmt.Println(string(buf))
~~~
文件拷贝
~~~go
func main () {
	//打开要读取的文件
    fr, err := os.Open("C:/123/test.txt")
    if err != nil {
        fmt.Println("Open err:", err)
        return
    }
    defer fr.Close()
    //创建要写入的文件
    fw, err := os.Create("C:/123/my.txt")
    if err != nil {
        fmt.Println("Create err:", err)
        return
    }
    defer fw.Close()
    //创建一个切片缓冲区
    buf := make([]byte, 4096)
    for {
        //将读到的数据放入buf切片缓冲区中
        n, err := fr.Read(buf)
        if err != nil && err == io.EOF {
            fmt.Printf("读完")
            return
        }
        //将读取后放入缓冲区的内容写入要写入的文件中
        fw.Write(buf[:n])
    }
}
~~~
遍历目录
~~~go
func main() {
	var path string
    fmt.Scan(&path)
    //打开目录
    f, err := os.OpenFile(path, os.O_RDONLY, os.ModeDir)
    if err != nil {
        fmt.Println("OpenFile err:", err)
        return
    }
    defer f.Close()
    //读取目录项
    info, err := f.Readdir(-1)	//负值代表读取目录中的所有目录项
    if err != nil {
        fmt.Println("Readdir err:", err)
        return
    }
    //遍历返回的切片
    for _, fileinfo := range info {
        if fileinfo.IsDir() {
            fmt.Println(fileinfo.Name(),"是一个目录")
        }else{
        	fmt.Println(fileinfo.Name(),"是一个文件")
        }
    }
}
~~~
