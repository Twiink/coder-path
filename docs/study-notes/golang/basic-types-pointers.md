---
title: "基础类型与常量指针"
tags:
  - "后端"
  - "go"
  - "笔记"
category: "后端"
folder: "Go"
parent: "[[后端/Go/环境配置与fmt]]"
related:
  - "[[后端/Go/流程控制与函数]]"
  - "[[目录]]"
created: 2025-12-06
updated: 2026-09-06
---

# 基础类型、常量与指针

## 基础类型
类型 | 长度(字节) | 默认值 | 说明
---|--------|-----|---
bool | 1 | false | 
byte | 1 | 0 | uint8
rune | 4 | 0 | Unicode Code Point, int32
int, uint | 4或8 | 0 | 32 或 64 位
int8, uint8 | 1 | 0 | -128 ~ 127, 0 ~ 255，byte是uint8 的别名
int16, uint16 | 2 | 0 | -32768 ~ 32767, 0 ~ 65535
int32, uint32 | 4 | 0 | -21亿~ 21亿, 0 ~ 42亿，rune是int32 的别名
int64, uint64 | 8 | 0 | 
float32 | 4 | 0.0 | 
float64 | 8 | 0.0 | 
complex64 | 8 |  | 
complex128 | 16 |  | 
uintptr | 4或8 |  | 以存储指针的 uint32 或 uint64 整数
array |  |  | 值类型
struct |  |  | 值类型
string |  | "" | UTF-8 字符串
slice |  | nil | 引用类型
map |  | nil | 引用类型
channel |  | nil | 引用类型
interface |  | nil | 接口
function |  | nil | 函数

1. 值类型: 变量直接存储值, 内存通常在栈中分配

- 值类型: int系列, float系列, bool, string, array, struct

2. 引用类型: 变量存储的是地址, 地址对应的空间存储真正的值, 通常在堆中分配, 当没有变量引用这个地址时, 地址对应的空间被视为垃圾, 由GC来回收

- 引用类型: 指针pointer, 切片slice, 字典map, 管道chan, 接口interface

**整型**

|  类型  |                             描述                             |
| :----: | :----------------------------------------------------------: |
| uint8  |                  无符号 8位整型 (0 到 255)                   |
| uint16 |                 无符号 16位整型 (0 到 65535)                 |
| uint32 |              无符号 32位整型 (0 到 4294967295)               |
| uint64 |         无符号 64位整型 (0 到 18446744073709551615)          |
|  int8  |                 有符号 8位整型 (-128 到 127)                 |
| int16  |              有符号 16位整型 (-32768 到 32767)               |
| int32  |         有符号 32位整型 (-2147483648 到 2147483647)          |
| int64  | 有符号 64位整型 (-9223372036854775808 到 9223372036854775807) |

**特殊整型**

|  类型   |                        描述                        |
| :-----: | :------------------------------------------------: |
|  uint   | 32位操作系统上就是uint32，64位操作系统上就是uint64 |
|   int   | 32位操作系统上就是int32，64位操作系统上就是int64  |
| uintptr |            无符号整型，用于存放一个指针            |

::: tip
在使用`int`和 `uint`类型时，不能假定它是32位或64位的整型，而是考虑`int`和`uint`可能在不同平台上的差异。
:::
::: tip
获取对象的长度的内建`len()`函数返回的长度可以根据不同平台的字节长度进行变化。实际使用中，切片或 map 的元素数量等都可以用`int`来表示。在涉及到二进制传输、读写文件的结构描述时，为了保持文件的结构不会受到不同编译目标平台字节长度的影响，不要使用`int`和 `uint`
:::
**浮点型**

Go语言支持两种浮点型数：`float32`和`float64`。这两种浮点型数据格式遵循`IEEE 754`标准：
- `float32` 的浮点数的最大范围约为 `3.4e38`，可以使用常量定义：`math.MaxFloat32`。
- `float64` 的浮点数的最大范围约为 `1.8e308`，可以使用一个常量定义：`math.MaxFloat64`。

**复数**

complex64和complex128

复数有实部和虚部:
- complex64的实部和虚部为32位。
- complex128的实部和虚部为64位。

**基本数据转String**
~~~go
fmt.Sprintf()

strconv.FormatInt(变量, 进制)

strconv.FormatFloat(变量, 格式, 小数保留几位, 小数类型值如: 64)

strconv.FormatBool(变量)

strconv.Itoa(变量)
~~~
**String转基本数据**
~~~go
Parse系列函数有两个返回值,可以用b,_接收,下划线表示忽略

strconv.ParseBool(变量)

strconv.ParseInt(变量, 进制, 整型位数)

strconv.ParseFloat(变量, 小数类型位数)
~~~

## 常量
- 使用关键字const声明
- 常量定义时必须初始化赋值, 不可修改
- 只能修饰bool, 数字, 字符串

`iota`的使用：
~~~go
func main() &#123;
	//iota数值递增
	const (
		a = iota
		b
		c, d = iota, iota	//不会递增
	)
	fmt.Println(a,b,c,d) //0,1,2,2
&#125;
~~~

## 指针
- 变量的地址存的值, 地址通过: &变量 获取
- 指针变量存储的地址里的值通过: *指针变量 获取
- 指针用来存储内存地址,且只能存一个,重复存储会覆盖掉旧值
- 值类型都有对应的指针类型

~~~go
var num int = 10 
var ptr *int = &num
//将num的内存地址赋值给指针类型的ptr
//*int表示指针类型, &num表示num在内存中的地址
fmt.Printf("%v", &num)//num的内存地址
fmt.Printf("%v", ptr)//num的内存地址
fmt.Printf("%v", &ptr)//ptr的内存地址
fmt.Printf("%v", *ptr)//取出存储的num地址里的值,也就是10

指针初始化：// &i为指针地址，i为值地址，*I为具体值
var i *int; 
i = new(int); 
*i = 1
~~~
运算符注意点：
1. 整数相除会舍弃小数位
2. ++和--只能独立使用, 如( a = i++ )是错误的
3. 只有(i++, i--) 没有(++i, --i)
4. %取余的本质是: a % b = a - a / b * b
   
获取控制台输入的值：
~~~go
fmt.Scanf(指定%格式, 变量地址)与fmt.Scanln(变量地址)
~~~
