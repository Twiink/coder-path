---
title: "泛型"
tags:
  - "后端"
  - "go"
  - "笔记"
category: "后端"
folder: "Go"
parent: "[[后端/Go/文件操作]]"
related:
  - "[[后端/Go/反射]]"
  - "[[目录]]"
created: 2025-12-06
updated: 2026-09-06
---

# 泛型
要定义泛型函数或类型，可以使用类型 `T` 关键字，后跟用方括号[]括起来的泛型形参的名称。例如，要创建一个接受任意类型的`slice`并返回其第一个元素的泛型函数，可以这样定义:
~~~go
func First[T any](items []T) T {
    return items[0]
}
// [T any]表示类型参数T，它表示任意类型。any关键字表示T类型可以是任何有效类型。
~~~
可以使用任何切片类型调用`First`函数，该函数将返回该切片的第一个元素。例如:
~~~go
func func1() {
	intSlice := []int{1, 2, 3, 4, 5}
	firstInt := First[int](intSlice) // returns 1

	println(firstInt)

	stringSlice := []string{"apple", "banana", "cherry"}
	firstString := First[string](stringSlice) // returns "apple"

	println(firstString)
}

func First[T any](items []T) T {
	return items[0]
}
~~~
编写函数`SumGenerics`，它对各种数字类型(如`int`、`int16`、`int32`、`int64`、`int8`、`float32`和`float64`)执行加法操作：
~~~go
func SumGenerics[T int | int16 | int32 | int64 | int8 | float32 | float64](a, b T) T {
    return a + b
}

func func2() {
	sumInt := SumGenerics[int](2, 3)

	sumFloat := SumGenerics[float32](2.5, 3.5)

	sumInt64 := SumGenerics[int64](10, 20)

	fmt.Println(sumInt)   // returns 5
	fmt.Println(sumFloat) // returns 6.0
	fmt.Println(sumInt64) // returns 30
}
~~~
泛型可以用于任意数据类型的序列化和反序列化，实现序列化和反序列化函数:
~~~go
type Person struct {
 	Name    string
 	Age     int
 	Address string
}

func Serialize[T any](data T) ([]byte, error) {
  	buffer := bytes.Buffer{}
  	encoder := gob.NewEncoder(&buffer)
  	err := encoder.Encode(data)
  	if err != nil {
    	return nil, err
  	}
  	return buffer.Bytes(), nil
}

func Deserialize[T any](b []byte) (T, error) {
	buffer := bytes.Buffer{}
	buffer.Write(b)
	decoder := gob.NewDecoder(&buffer)
	var data T
	err := decoder.Decode(&data)
	if err != nil {
		return data, err
	}
	return data, nil
}
// 函数Serialize和Deserialize，它们利用Go的gob包将任意数据类型转换为字节，反之亦然。

func DeserializeUsage() {
	// 创建一个Person实例
	person := Person{
		Name:    "John",
		Age:     30,
		Address: "123 Main St.",
	}
	// 将person对象转换为字节数组
	serialized, err := Serialize(person)
	if err != nil {
    	panic(err)
	}
	// 将字节数组转换回Person对象
	deserialized, err := Deserialize[Person](serialized)
	if err != nil {
    	panic(err)
  	}
  
	fmt.Printf("Name: %s, Age: %d, Address: %s", deserialized.Name, deserialized.Age, deserialized.Address)
	// Output: Name: John, Age: 30, Address: 123 Main St.
}
~~~
自定义验证器编写一个通用的`Validate`函数:
~~~go
// 接受任意类型T的值并返回一个错误
type Validator[T any] func(T) error
// 使用自定义验证器执行数据验证
func Validate[T any](data T, validators ...Validator[T]) error {
	for _, validator := range validators {
		err := validator(data)
		if err != nil {
			return err
		}
	}
	return nil
}
// 自定义验证器：确保字符串不为空
func StringNotEmpty(s string) error {
	if len(strings.TrimSpace(s)) == 0 {
		return fmt.Errorf("string cannot be empty")
	}
	return nil
}
// 自定义验证器：检查整数是否在指定范围内
func IntInRange(num int, min, max int) error {
	if num < min || num > max {
		return fmt.Errorf("number must be between %d and %d", min, max)
	}
	return nil
}

func main() {
	person := Person{
		Name:    "John",
		Age:     30,
		Address: "123 Main St.",
	}
	
	err := Validate(
		person, // 实例
		func(p Person) error {	// 验证 name 是否为空
			return StringNotEmpty(p.Name)
		}, 
		func(p Person) error {	// 验证 age 是否在0~120之内
			return IntInRange(p.Age, 0, 120)
		}
	)
	
	if err != nil {
		println(err.Error())
		panic(err)
	}
	
	println("Person is valid")
}
~~~
通过使用泛型和自定义验证器，`Validate`函数允许跨不同数据类型进行灵活和可重用的数据验证，增强代码可重用性，并使添加或修改验证规则变得容易。

再写一个登录验证的示例：
~~~go
// 登录表单的结构体
type LoginForm struct {
    Username string
    Password string
}

// 接受任意类型T的值并返回一个错误
type Validator[T any] func(T) error

// 使用自定义验证器执行数据验证
func Validate[T any](data T, validators ...Validator[T]) error {
	for _, validator := range validators {
		err := validator(data)
		if err != nil {
			return err
		}
	}
	return nil
}

// 自定义验证器：确保字符串不为空
func StringNotEmpty(s string) error {
	if len(strings.TrimSpace(s)) == 0 {
		return fmt.Errorf("string cannot be empty")
	}
	return nil
}

// 给 LoginForm 实现一个 Validate 方法
func (f *LoginForm) Validate() error {
    return Validate(f,
        func(l *LoginForm) error {
            return StringNotEmpty(l.Username)	// 验证用户名
        },
        func(l *LoginForm) error {
            return StringNotEmpty(l.Password)	// 验证密码
        },
    )
}

func main() {
    loginForm := LoginForm{
        Username: "John",
        Password: "123",
    }

    err := loginForm.Validate() // 调用校验方法
    if err != nil {
        println(err.Error())
        panic(err)
    }

    println("Login form is valid")
}
~~~
