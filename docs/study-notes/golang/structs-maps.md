---
title: "结构体与Map"
tags:
  - "后端"
  - "go"
  - "笔记"
category: "后端"
folder: "Go"
parent: "[[后端/Go/错误处理]]"
related:
  - "[[后端/Go/接口]]"
  - "[[目录]]"
created: 2025-12-06
updated: 2026-09-06
---

# 结构体与 Map

## 结构体
- 结构体元素的地址是连续的, 是值类型
- 在方法调用中遵守值拷贝传递的方式
- 若要修改结构体变量的值, 可以通过结构体指针的方式去处理

~~~go
type Circle struct {
	raduis float64
}

func (c Circle) area() float64 {
	return 3.14 * c.raduis * c.raduis
}
func (c *Circle) area2() float64 {
	c.raduis = 10.0
	return 3.14 * c.raduis * c.raduis
} 
func main()  {
	var name Circle
	name.raduis = 5.0
	res := name.area2()
	fmt.Println(res)	//输出314
}
//在方法area2中通过指针改变了结构体中radius的值, 指针指向的结构体本身.
~~~
结构体类型相互转换时: 元素的名字, 个数, 类型必须完全相同
~~~go
type A struct {
	number int
}
type B struct {
	number int
}
func main()  {
	var a A
	var b B
	a = A(b)
	fmt.Println(a,b)
}
//当元素的名字, 个数, 类型完全相同, 可以进行类型强转
~~~
公共结构体元素首字母大写转json格式时, 可以通过tag标签标记转换时为小写
~~~go
type Circle struct {
	Radius float64 `json:"radius"`
}
func main()  {
	var name Circle
	a,_ := json.Marshal(name)
	fmt.Println(string(a))	//{"radius":0}
}
//json.Marshal()将结构体转换为字节码, 通过string()内置函数转换为字符串
~~~
**方法与函数总结**
1. 不管调用形式如何, 真正决定是值拷贝还是地址拷贝, 看这个方法是和哪个类型绑定
2. 如果是值类型, 如(p Person)则是值拷贝, 如果是指针类型, 如(p *Person)则是地址拷贝

工厂模式解决私有结构体跨包使用
~~~go
//主包
type a struct {
	number int
}
func News(b int) *a {
	return &a{
		number: b,
	}
}
//跨包(model包)
func main()  {
	var stu = model.News(10)
	fmt.Println(*stu)
}
~~~

## Map
`map`是一种无序的基于`key:value`的数据结构，Go语言中的 `map` 是引用类型，必须初始化才能使用。

语法定义：
~~~go
map[KeyType]ValueType

//KeyType:表示键的类型。
//ValueType:表示键对应的值的类型。
~~~
`map`类型的变量默认初始值为`nil`，需要使用`make()`函数来分配内存。语法为：
~~~go
make(map[KeyType]ValueType, [cap])

// 其中cap表示map的容量，该参数虽然不是必须的，但是我们应该在初始化map的时候就为其指定一个合适的容量。
~~~
基本用法：
~~~go
scoreMap := make(map[string]int, 8)	// 初始化map，并设置容量8
scoreMap["张三"] = 90	// 向map变量中插入数据
~~~
~~~go
// 声明时填充元素
userInfo := map[string]string{
	"username": "pprof.cn",
	"password": "123456",
}
~~~
判断`map`中键是否存在：
~~~go
scoreMap := make(map[string]int)
// 如果key存在ok为true,v为对应的值；不存在ok为false,v为值类型的零值
v, ok := scoreMap["张三"]
~~~
遍历`map`：
~~~go
scoreMap := make(map[string]int)
scoreMap["张三"] = 90
scoreMap["小明"] = 100
scoreMap["王五"] = 60
// 需要使用 for range 遍历
for k, v := range scoreMap {
	fmt.Println(k, v)
}
~~~
使用 `delete()` 删除 `map` 中的键值对：
~~~go
delete(scoreMap, "小明")// 将键为'小明'的数据从map变量scoreMap中删除
~~~
按照指定顺序遍历`map`：
~~~go
rand.Seed(time.Now().UnixNano()) //初始化随机数种子

var scoreMap = make(map[string]int, 200)

for i := 0; i < 100; i++ {
	key := fmt.Sprintf("stu%02d", i) //生成stu开头的字符串
	value := rand.Intn(100)          //生成0~99的随机整数
	scoreMap[key] = value
}
//取出map中的所有key存入切片keys
var keys = make([]string, 0, 200)
for key := range scoreMap {
	keys = append(keys, key)
}
//对切片进行排序
sort.Strings(keys)
//按照排序后的key遍历map
for _, key := range keys {
	fmt.Println(key, scoreMap[key])
}
~~~
元素为`map`类型的切片：
~~~go
var mapSlice = make([]map[string]string, 3)
for index, value := range mapSlice {
	fmt.Printf("index:%d value:%v\n", index, value)
}
fmt.Println("after init")
// 对切片中的map元素进行初始化
mapSlice[0] = make(map[string]string, 10)
mapSlice[0]["name"] = "王五"
mapSlice[0]["password"] = "123456"
mapSlice[0]["address"] = "红旗大街"
for index, value := range mapSlice {
	fmt.Printf("index:%d value:%v\n", index, value)
}
~~~
值为切片类型的`map`:
~~~go
var sliceMap = make(map[string][]string, 3)
fmt.Println(sliceMap)
fmt.Println("after init")
key := "中国"
value, ok := sliceMap[key]
if !ok {
	value = make([]string, 0, 2)
}
value = append(value, "北京", "上海")
sliceMap[key] = value
fmt.Println(sliceMap)
~~~
