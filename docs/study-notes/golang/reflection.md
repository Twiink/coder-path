---
title: "反射"
tags:
  - "后端"
  - "go"
  - "笔记"
category: "后端"
folder: "Go"
parent: "[[后端/Go/泛型]]"
related:
  - "[[后端/Go/网络编程与并发模型]]"
  - "[[目录]]"
created: 2025-12-06
updated: 2026-09-06
---

# 反射
反射是指在程序运行期对程序本身进行访问和修改的能力

变量的内在机制：
- 变量包含类型信息和值信息 `var arr [10]int arr[0] = 10`
- 类型信息：是静态的元信息，是预先定义好的
- 值信息：是程序运行过程中动态改变的

反射的使用：
- `reflect`包封装了反射相关的方法
- 获取类型信息：`reflect.TypeOf`，是静态的
- 获取值信息：`reflect.ValueOf`，是动态的

空接口与反射:
- 反射可以在运行时动态获取程序的各种详细信息
- 反射获取`interface`类型信息
  	~~~go
  	//反射获取interface类型信息

  	func reflect_type(a interface{}) {
  		t := reflect.TypeOf(a)
  		fmt.Println("类型是：", t)
  		// kind()可以获取具体类型
  		k := t.Kind()
  		fmt.Println(k)
  	    switch k {
  			case reflect.Float64:
  				fmt.Printf("a is float64\n")
  			case reflect.String:
  				fmt.Println("string")
  		}
  	}

  	func main() {
  		var x float64 = 3.4
  		reflect_type(x)
  	}
  	~~~
- 反射获取`interface`值信息
	~~~go
	//反射获取interface值信息

	func reflect_value(a interface{}) {
		v := reflect.ValueOf(a)
		fmt.Println(v)
		k := v.Kind()
		fmt.Println(k)
		switch k {
		case reflect.Float64:
			fmt.Println("a是：", v.Float())
		}
	}

	func main() {
		var x float64 = 3.4
		reflect_value(x)
	}
	~~~
- 反射修改值信息
	~~~go
	//反射修改值
	func reflect_set_value(a interface{}) {
		v := reflect.ValueOf(a)
		k := v.Kind()
		switch k {
		case reflect.Float64:
			// 反射修改值
			v.SetFloat(6.9)
			fmt.Println("a is ", v.Float())
		case reflect.Ptr:
			// Elem()获取地址指向的值
			v.Elem().SetFloat(7.9)
			fmt.Println("case:", v.Elem().Float())
			// 地址
			fmt.Println(v.Pointer())
		}
	}

	func main() {
		var x float64 = 3.4
		// 反射认为下面是指针类型，不是float类型
		reflect_set_value(&x)
		fmt.Println("main:", x)
	}
	~~~
结构体与反射:
- 查看类型、字段和方法
	~~~go
	// 定义结构体
	type User struct {
		Id   int
		Name string
		Age  int
	}

	// 绑方法
	func (u User) Hello() {
		fmt.Println("Hello")
	}

	// 传入interface{}
	func Poni(o interface{}) {
		t := reflect.TypeOf(o)
		fmt.Println("类型：", t)
		fmt.Println("字符串类型：", t.Name())
		// 获取值
		v := reflect.ValueOf(o)
		fmt.Println(v)
		// 可以获取所有属性
		// 获取结构体字段个数：t.NumField()
		for i := 0; i < t.NumField(); i++ {
			// 取每个字段
			f := t.Field(i)
			fmt.Printf("%s : %v", f.Name, f.Type)
			// 获取字段的值信息
			// Interface()：获取字段对应的值
			val := v.Field(i).Interface()
			fmt.Println("val :", val)
		}
		fmt.Println("=================方法====================")
		for i := 0; i < t.NumMethod(); i++ {
			m := t.Method(i)
			fmt.Println(m.Name)
			fmt.Println(m.Type)
		}

	}

	func main() {
		u := User{1, "zs", 20}
		Poni(u)
	}
	~~~
- 查看匿名字段
	~~~go
	// 定义结构体
	type User struct {
		Id   int
		Name string
		Age  int
	}

	// 匿名字段
	type Boy struct {
		User
		Addr string
	}

	func main() {
		m := Boy{User{1, "zs", 20}, "bj"}
		t := reflect.TypeOf(m)
		fmt.Println(t)
		// Anonymous：匿名
		fmt.Printf("%#v\n", t.Field(0))
		// 值信息
		fmt.Printf("%#v\n", reflect.ValueOf(m).Field(0))
	}
	~~~
- 修改结构体的值
	~~~go
	// 定义结构体
	type User struct {
		Id   int
		Name string
		Age  int
	}

	// 修改结构体值
	func SetValue(o interface{}) {
		v := reflect.ValueOf(o)
		// 获取指针指向的元素
		v = v.Elem()
		// 取字段
		f := v.FieldByName("Name")
		if f.Kind() == reflect.String {
			f.SetString("kuteng")
		}
	}

	func main() {
		u := User{1, "5lmh.com", 20}
		SetValue(&u)
		fmt.Println(u)
	}
	~~~
- 调用方法
	~~~go
	// 定义结构体
	type User struct {
		Id   int
		Name string
		Age  int
	}

	func (u User) Hello(name string) {
		fmt.Println("Hello：", name)
	}

	func main() {
		u := User{1, "5lmh.com", 20}
		v := reflect.ValueOf(u)
		// 获取方法
		m := v.MethodByName("Hello")
		// 构建一些参数
		args := []reflect.Value{reflect.ValueOf("6666")}
		// 没参数的情况下：var args2 []reflect.Value
		// 调用方法，需要传入方法的参数
		m.Call(args)
	}
	~~~
- 获取字段的tag
	~~~go
	type Student struct {
		Name string `json:"name1" db:"name2"`
	}

	func main() {
		var s Student
		v := reflect.ValueOf(&s)
		// 类型
		t := v.Type()
		// 获取字段
		f := t.Elem().Field(0)
		fmt.Println(f.Tag.Get("json"))
		fmt.Println(f.Tag.Get("db"))
	}
	~~~
案例:
~~~go
//对int类型的反射
func reflect1(b interface{}) {
	rtype := reflect.TypeOf(b)
	fmt.Println("rtype=", rtype)
	//输出类型为int, 实际类型为reflect.type
	rvalue := reflect.ValueOf(b)
	fmt.Printf("rvalue=%v type=%T\n", rvalue, rvalue)
	//输出值为100, 实际类型为reflect.value
	a := 2 + rvalue.Int()
	fmt.Println("a=", a)
	//无法做值操作,需要使用方法Int()转换
	iv := rvalue.Interface()
	//转回interface{}类型
	num := iv.(int)
	fmt.Println("num=", num)
	//将interface通过断言转成需要的类型
}
//对结构体的反射
func reflect2(b interface{})  {
	rtype := reflect.TypeOf(b)
	fmt.Println("rtype=", rtype)
	//输出类型为student, 实际类型为reflect.type
	rvalue := reflect.ValueOf(b)
	fmt.Printf("rvalue=%v type=%T\n", rvalue, rvalue)
	//输出值为{高江华, 26}, 实际类型为reflect.value
	iv := rvalue.Interface()
	//转回interface{}类型
	fmt.Printf("iv=%v iv=%T\n", iv, iv)
	//值{高江华, 26} 类型student
	//反射是运行时的反射, 这里的iv无法取到内部的值, 因编译不通过
	stu, ok := iv.(student)
	if ok {
		fmt.Printf("stu.Name=%v\n", stu.Name)
	}
	//需要进行类型断言后,才能取到内部的值
}
//声明结构体类型
type student struct {
	Name string
	Age int
}

func main() {
	var num int = 100
	reflect1(num)
	//定义结构体实例
	stu := student{
		Name: "高江华",
		Age: 26,
	}
	reflect2(stu)
}
~~~
获取反射对象的底层类型的方法:
~~~go
var num int = 10
value := reflect.ValueOf(num)

fmt.Println(value.Kind()) // 输出：int
~~~
通过反射来修改变量，使用SetXxx()方法，Xxx就是类型，比如: SetInt()：
~~~go
// 修改前需要使用对应的指针类型来完成
// 同时需要使用Elem()方法
func main() {
	var num int = 100
	fn := reflect.ValueOf(&num)
	fn.Elem().SetInt(200)
    //Elem()用于获取指针指向的变量
	fmt.Printf("%v\n", num)	//输出200
}
~~~
获取结构体（`struct`）类型的值 `val` 的字段数量的方法:
~~~go
type Person struct {
    Name string
    Age  int
}

p := Person{Name: "Alice", Age: 30}

// 获取结构体字段数量
num := reflect.ValueOf(p).NumField()

fmt.Println(num) // 输出：2
~~~
获取结构体类型值的指定字段的值，需要先进行类型断言来将其转换为具体的类型，然后才能对字段的值进行操作：
~~~go
type Person struct {
	Name string
	Age  int
}

func main() {
	p := Person{Name: "Alice", Age: 30}
	
	value := reflect.ValueOf(p)
	
	nameField := value.Field(0)
	ageField := value.Field(1)
	
	if nameField.Kind() == reflect.String {
		fmt.Println(nameField.String()) // 输出：Alice
	}
	
	if ageField.Kind() == reflect.Int {
		age := ageField.Int()
		fmt.Println(age) // 输出：30
	}
}
~~~
获取结构体类型的指定字段的反射信息：
~~~go
type Person struct {
	Name string
	Age  int
}

func main() {
	t := reflect.TypeOf(Person{})
	
	nameField, _ := t.FieldByName("Name")
	ageField, _ := t.FieldByName("Age")
	
	fmt.Println(nameField.Name) // 输出：Name
	fmt.Println(ageField.Name)  // 输出：Age
}
~~~
获取类型的方法数量：
~~~go
type Person struct {
	Name string
	Age  int
}

func (p Person) SayHello() {
	fmt.Println("Hello, my name is", p.Name)
}

func (p Person) GetAge() int {
	return p.Age
}

func main() {
	p := Person{Name: "Alice", Age: 30}
	
	value := reflect.ValueOf(p)
	
	// NumMethod() 只能应用于接收者为值或指针类型的方法，不能应用于接口类型。
	numMethods := value.NumMethod()
	
	fmt.Println(numMethods) // 输出：2
}
~~~
获取指定索引位置的方法的反射值: 
~~~go
//结构体上的方法的排序依据方法首字母在ascll码表上的大小排序
//call方法传入一个反射类型切片并返回一个反射类型切片
//用于方法调用传参
var params []reflect.Value
params = append(params, reflect.ValueOf(10))
params = append(params, reflect.ValueOf(20))
res := params.Method(0).Call(params)
fmt.Println("res=", res[0].Int())
//调用结构体上的第一个方法并传入两个int参数
//输出方法调用后返回的int值并通过Int()转换类型获取真实的值
~~~
根据字段名获取结构体类型值的指定字段的值:
~~~go
type Person struct {
	Name string
	Age  int
}

func main() {
	p := Person{Name: "Alice", Age: 30}
	
	value := reflect.ValueOf(p)
	
	nameField := value.FieldByName("Name")
	ageField := value.FieldByName("Age")
	
	fmt.Println(nameField) // 输出：Alice
	fmt.Println(ageField)  // 输出：30
}
~~~
创建一个指定类型的指针值:
~~~go
type Person struct {
	Name string
	Age  int
}

func main() {
	pType := reflect.TypeOf(Person{})

	// New() 方法返回一个 reflect.Value 对象，该对象包含了一个指向新创建对象的指针值
	ptr := reflect.New(pType)
	
	fmt.Println(ptr) // 输出：&{{ } 0}

	// 如果你想获取指针值所指向的对象，可以使用 Elem() 方法来间接访问
	person := ptr.Elem().Interface().(Person)
	fmt.Println(person) // 输出：{ 0}
}
~~~
