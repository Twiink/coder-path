---
title: "员工信息管理-Django"
aliases:
  - "修改时区为国内时区"
tags:
  - "后端"
  - "django"
  - "笔记"
category: "后端"
folder: "Django"
parent: "[[后端/Django/Django入门与项目搭建]]"
related:
  - "[[后端/Django/Django入门与项目搭建]]"
  - "[[后端/Django/模型层与ORM]]"
created: 2025-07-22
updated: 2026-04-04
---

## 零. 开发前的准备
### 软件安装
#### git和github配置
![](https://cdn.nlark.com/yuque/0/2025/png/40552572/1737097867469-dbbefbef-c6d1-4803-bc4a-b5a8368f0a7f.png)

[https://blog.csdn.net/mukes/article/details/115693833](https://blog.csdn.net/mukes/article/details/115693833)

```python
git config –global user.name ‘xxxxx’ 
git config –global user.email ‘xxx@xx.xxx’

ssh-keygen -t rsa -C "xxx@xxx.com"
cd ~/.ssh
cat id_rsa.pub
```

<font style="color:rgb(77, 77, 77);">编辑器打开之前生成的文件id_rsa.pub,复制文件中的公钥内容</font>

<font style="color:rgb(77, 77, 77);">.ssh/config</font>

```python
Host github.com
 Hostname ssh.github.com
 Port 443
```

#### pycharm专业版
![](https://cdn.nlark.com/yuque/0/2025/png/40552572/1737098045488-e0371508-b758-4317-ba9f-34c2731aa233.png)



#### Typora
阅读笔记的软件



#### redis
缓存数据库

[https://blog.csdn.net/weixin_44893902/article/details/123087435](https://blog.csdn.net/weixin_44893902/article/details/123087435)

#### python以及虚拟环境
python版本选择python3.10

替换pip源：pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

![](https://cdn.nlark.com/yuque/0/2025/png/40552572/1737098772526-ef9e954e-7937-4cb9-803d-beb96f3a99f9.png)

### 服务器配置
 yum install rsync  

### 自动部署配置
#### ssh密钥
<font style="color:rgb(51, 51, 51);">使用root用户进行部署，防止出现权限不足的问题。由于新的服务器初始情况下root用户没有密码，所以需要给root用户设置密码</font>

```plain
sudo passwd root
```

<font style="color:rgb(51, 51, 51);">给用户设置完成密码后需要开启服务器的root远程登录权限</font>

```plain
vim /etc/ssh/sshd_conf
```

<font style="color:rgb(51, 51, 51);">然后将以下更改</font>

```plain
PermitRootLogin yes
```

<font style="color:rgb(51, 51, 51);">之后生成密钥</font>

```plain
ssh-keygen -t rsa -b 4096 -C "matrix_studio_0@1xxx.com"
```

<font style="color:rgb(119, 119, 119);">注意：一直回车即可，要确定自动生成的ssh密钥路径是/root/.ssh/</font>

<font style="color:rgb(51, 51, 51);">然后执行</font>

```plain
cat /root/.ssh/id_rsa.pub >> /root/.ssh/authorized_keys
```

<font style="color:rgb(51, 51, 51);">最后将id_rsa里的内容添加到项目的settings里键名为backend.yml里的配置，这里我们的是SERVER_SSH_KEY</font>

```plain
SSH_PRIVATE_KEY: ${{ secrets.SERVER_SSH_KEY }}
```

#### <font style="color:rgb(51, 51, 51);">新建网站</font>
```python
location ^~ /api {
        rewrite ^/api/(.*)$ /$1 break;
        include uwsgi_params;
        uwsgi_pass 127.0.0.1:10061;
    }
```



```python
location /static {
        alias   /home/files/;
        autoindex on;
    }
```

#### <font style="color:rgb(51, 51, 51);">自动部署文件</font>
.github/workflows/backend.yml

```plain
name: Backend CI

on:
  push:
    branches: [ "main" ]

jobs:
  build:
    runs-on: ubuntu-20.04
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python 3.10
        uses: actions/setup-python@v3
        with:
          python-version: "3.10.0"
      - name: Build the Docker image
        run: |
          docker version
          docker login --username=${{ secrets.ALI_DOCKER_USERNAME }} --password=${{ secrets.ALI_DOCKER_PASSWORD }} crpi-4gclhim218z4wzwg.cn-beijing.personal.cr.aliyuncs.com
          cd EmpManagerBackend
          docker build . --file Dockerfile --tag crpi-4gclhim218z4wzwg.cn-beijing.personal.cr.aliyuncs.com/my_worktest/emp-manager-backend:master
          docker push crpi-4gclhim218z4wzwg.cn-beijing.personal.cr.aliyuncs.com/my_worktest/emp-manager-backend:master
      - name: Deploy to Server
        uses: easingthemes/ssh-deploy@v2.1.5
        env:
          SSH_PRIVATE_KEY: ${{ secrets.SERVER_SSH_KEY }}
          SOURCE: EmpManagerBackend/*
          REMOTE_HOST: 1.92.102.7
          REMOTE_USER: root
          TARGET: /www/wwwroot/EmpManager/EmpManagerBackend
      - name: Remote SSH Deploy Command
        uses: appleboy/ssh-action@master
        with:
          host: 1.92.102.7
          username: root
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /www/wwwroot/EmpManager/EmpManagerBackend
            docker login --username=${{ secrets.ALI_DOCKER_USERNAME }} --password=${{ secrets.ALI_DOCKER_PASSWORD }} crpi-4gclhim218z4wzwg.cn-beijing.personal.cr.aliyuncs.com
            make pull_dev
            make restart_dev
            docker image prune -a -f

```

<font style="color:rgb(51, 51, 51);">docker-compose.yml</font>

```plain
version: "3"
services:
  django:
    image: crpi-4gclhim218z4wzwg.cn-beijing.personal.cr.aliyuncs.com/my_worktest/emp-manager-backend:master
    command: sh django_entrypoint.sh
    networks:
      - emp_manager_net
    ports:
      - "10061:8000"
    volumes:
      - ./:/app/EmpManagerBackend
    #      - ./logs:/usr/local/var/log/django
    environment:
      - MYSQL_HOST=192.168.0.53
      - MYSQL_PORT=3306
      - MYSQL_NAME=EmpManager
      - MYSQL_USER=EmpManager
      - MYSQL_PASSWORD=GGsYPKLbLGRDDTpR
      - REDIS_HOST=192.168.0.53
      - REDIS_PORT=6379
      - REDIS_DB=4
      - REDIS_PASSWORD=GGsYPKLbLGRDDTpR
    restart: always
networks:
  emp_manager_net:
    driver: bridge

```

<font style="color:rgb(51, 51, 51);">Dockerfile</font>

```plain
FROM python:3.10

RUN apt update -y
RUN apt-get update -y
RUN apt-get install vim ffmpeg libsm6 libxext6 -y

# 修改时区为国内时区
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 安装必要的项目依赖
WORKDIR /app/EmpManagerBackend
ADD ./requirements.txt /app/EmpManagerBackend/requirements.txt
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

ADD ./ /app/EmpManagerBackend
RUN mkdir -p /usr/local/var/log

```

<font style="color:rgb(51, 51, 51);">django_entrypoint.sh</font>

```plain
python manage.py makemigrations
python manage.py migrate

# 在收集静态文件之前先删除静态文件夹，否则会询问是否覆盖导致报错
rm -rf static
python manage.py collectstatic  --noinput

# gunicorn --bind=0.0.0.0:8000 --access-logfile=/usr/local/var/log/django/access.log --error-logfile=/usr/local/var/log/django/error.log --capture-output --workers=9 --threads=2 --timeout 30 EmpManagerBackend.wsgi --limit-request-fields 32768 --limit-request-field_size 64000
uwsgi emp.ini

```

<font style="color:rgb(51, 51, 51);">Makefile</font>

```plain
# ---开发环境---
build_dev:
	TAG=develop docker-compose -f docker-compose.yml build

push_dev:
	TAG=develop docker-compose -f docker-compose.yml push

pull_dev:
	TAG=develop docker-compose -f docker-compose.yml pull

up_dev:
	TAG=develop docker-compose --compatibility -f docker-compose.yml up -d --remove-orphans

down_dev:
	TAG=develop docker-compose -f docker-compose.yml down --remove-orphans

restart_dev:
	TAG=develop docker-compose -f docker-compose.yml down --remove-orphans
	TAG=develop docker-compose --compatibility -f docker-compose.yml up -d --remove-orphans

```

emp.ini

```plain
[uwsgi]
socket = 0.0.0.0:8000
chdir = /app/EmpManagerBackend/
wsgi-file = EmpManagerBackend/wsgi.py
processes = 4
threads = 2
master = True
pidfile = erp.pid
logto = logs/uwsgi.log
```

<font style="color:rgb(51, 51, 51);">  
</font><font style="color:rgb(51, 51, 51);">开发环境下的配置</font>

```python
from .base import *

DEBUG = False

ALLOWED_HOSTS = ["*"]
MYSQL_HOST = os.getenv("MYSQL_HOST", "39.101.136.131")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_NAME = os.getenv('MYSQL_NAME', "matrix_website")
MYSQL_USER = os.getenv("MYSQL_USER", "matrix_website")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "zmdK")
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": MYSQL_NAME,
        "HOST": MYSQL_HOST,
        "PORT": MYSQL_PORT,
        "PASSWORD": MYSQL_PASSWORD,
        "USER": MYSQL_USER,
        "OPTIONS": {
            "init_command": "SET foreign_key_checks = 0;",
            "charset": "utf8mb4",
        },
        'CONN_MAX_AGE': 300,
        'POOL_OPTIONS': {
            'MAX_CONNS': 20,  # 最大连接数
            'MAX_LIFETIME': 600,  # 连接的最大生命周期
        },
    }
}

REDIS_HOST = os.getenv("REDIS_HOST", "154.8.149.3")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB = int(os.getenv("REDIS_DB", "4"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "zmdK")

CACHES = {
    "default": {  # 默认
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }
    },
    "session": {  # access_token
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }
    },
    "verify_code": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }
    },
}
STATIC_ROOT = os.path.join(BASE_DIR.parent, 'static')
```

## 一. 开发准备   
### 项目架构
+ <font style="color:rgb(51, 51, 51);">项目采用前后端分离的应用模式</font>
+ <font style="color:rgb(51, 51, 51);">前端使用Vue3.js</font>
+ <font style="color:rgb(51, 51, 51);">后端使用Django REST framework</font>

### 项目创建
#### 仓库创建
![](https://cdn.nlark.com/yuque/0/2025/png/40552572/1736412376654-ccfd5b34-b5a5-4b15-ad23-e8875a6e9925.png)

![](https://cdn.nlark.com/yuque/0/2025/png/40552572/1736412392694-a96b131a-a701-40e2-b4ff-25f0b1f11de3.png)

#### 同步到本地
![](https://cdn.nlark.com/yuque/0/2025/png/40552572/1736412479018-121a1a82-3e61-4ab5-bc1a-3f467690ab41.png)

在文件夹下执行`git clone ssh地址`

修改.gitignore文件

![](https://cdn.nlark.com/yuque/0/2024/png/40552572/1728634510702-234f568e-3ea2-46e4-a6a7-f2bdcfbfd1ba.png)

#### 虚拟环境创建和项目创建
`mkvirtualenv emp_manager`

配置为项目的环境

安装Django和djangorestframework

`pip install django==4.2 djangorestframework`

创建工程

`django-admin startproject EmpManagerBackend`

## 二. 项目配置
### 目录准备
准备两个配置文件，两个文件都是从settings.py复制过来的，并将原先的settings.py删除

dev是开发环境，prod是生产环境

![](https://cdn.nlark.com/yuque/0/2025/png/40552572/1736414665989-0f21015a-d828-4f45-846a-2f921ff75019.png)

修改运行配置和部署配置

![](https://cdn.nlark.com/yuque/0/2025/png/40552572/1736414723803-1cb5342d-97f5-494e-b1ca-1c73e19fcc6c.png)

![](https://cdn.nlark.com/yuque/0/2024/png/40552572/1728635141130-974e0492-ff03-497e-9fb5-c9590dca928d.png)

![](https://cdn.nlark.com/yuque/0/2024/png/40552572/1728635168196-9378f665-0042-4f7e-b039-a76f99b1176b.png)

pycharm中运行配置修改

![](https://cdn.nlark.com/yuque/0/2024/png/40552572/1728635274318-3047c4d3-9c6e-41be-9395-6861e4298739.png)

### DRF应用注册
![](https://cdn.nlark.com/yuque/0/2024/png/40552572/1728635507132-648f9983-8658-4c26-a816-6e0af6bebf61.png)

### 数据库-Mysql
创建数据库：

`create database EmpManager charset=utf8;`

创建用户并授予权限

`create user EmpManager identified by'EmpManager';`

`grant all on EmpManager.* to'EmpManager'@'%';`

`flush privileges;`

安装包 pip install mysqlclient

```cpp
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'HOST': '127.0.0.1',  # 数据库主机
        'PORT': 3306,  # 数据库端口
        'USER': 'root',  # 数据库用户名
        'PASSWORD': 'root',  # 数据库用户密码
        'NAME': 'EmpManager'  # 数据库名字
    }
}
```

### 数据库-Redis
`pip install django-redis`

```python
CACHES = {
    "default": {  # 默认
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": "redis://127.0.0.1:6379/0",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }
    },
    "session": {  # 验证码
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": "redis://127.0.0.1:6379/1",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }
    },
    "verify_code": {  # 验证码
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": "redis://127.0.0.1:6379/2",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }
    },
}

# 配置session存储3种方式
# 存储在数据库中，如下设置可写可不写，是默认存储模式
# SESSION_ENGINE = "django.contrib.sessions.backends.db"
# 存储在缓存中，存储在本机内存中，如果丢失则不能找回，比数据库的方式读写更快
SESSION_ENGINE = "django.contrib.sessions.backends.cache"
# 混合存储：优先从本机内存中存取，如果没有则冲数据库中存取
# SESSION_ENGINE = "django.contrib.sessions.backends.cache_db"

SESSION_CACHE_ALIAS = "session"
```

[Ubuntu 22.04 LTS 上 安装 Redis_ubuntu 22.04 安装redis-CSDN博客](https://blog.csdn.net/weixin_45626288/article/details/134684876)

### 日志配置
```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,  # 是否禁用已经存在的日志器
    'formatters': {  # 日志信息显示的格式
        'verbose': {
            'format': '%(levelname)s %(asctime)s %(module)s %(filename)s: %(lineno)d %(message)s'
        },
        'simple': {
            'format': '%(levelname)s %(module)s %(lineno)d %(message)s'
        },
    },
    'filters': {  # 对日志进行过滤
        'require_debug_true': {  # django在debug模式下才输出日志
            '()': 'django.utils.log.RequireDebugTrue',
        },
    },
    'handlers': {  # 日志处理方法
        'console': {  # 向终端中输出日志
            'level': 'INFO',
            'filters': ['require_debug_true'],
            'class': 'logging.StreamHandler',
            'formatter': 'simple'
        },
        'file': {  # 向文件中输出日志
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': os.path.join(BASE_DIR.parent, 'logs/emp_manager.log'),  # 日志文件的位置
            'maxBytes': 300 * 1024 * 1024,
            'backupCount': 10,
            'formatter': 'verbose'
        },
    },
    'loggers': {  # 日志器
        'emp': {  # 自己用的logger应用如下配置
            'handlers': ['console', 'file'],  # 上线之后可以把'console'移除
            'level': 'DEBUG',
            'propagate': True,  # 是否向上一级logger实例传递日志信息
        },
        'django': {  # 定义了一个名为django的日志器
            'handlers': ['console', 'file'],  # 可以同时向终端与文件中输出日志
            'propagate': True,  # 是否继续传递日志信息
            'level': 'INFO',  # 日志器接收的最低日志级别
        },
    }
}
```

修改.gitignore

![](https://cdn.nlark.com/yuque/0/2024/png/40552572/1728637036108-decc07d4-7d5f-46a3-aff9-cde136b19c52.png)

创建文件和文件夹

![](https://cdn.nlark.com/yuque/0/2024/png/40552572/1728637062910-73fb96d0-483f-460d-a32c-9e7fa69c9af5.png)

### 数据库异常捕获
![](https://cdn.nlark.com/yuque/0/2024/png/40552572/1728637211332-793acd22-2114-4750-a0c8-c9d34c7a3ead.png)

```python
from rest_framework.views import exception_handler as drf_exception_handler
import logging
from django.db import DatabaseError
from redis.exceptions import RedisError
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger('django')


def exception_handler(exc, context):
    """
    自定异常捕获
    :param exc:异常
    :param context:抛出异常的上下文(包括request和view对象)
    :return: Response响应对象
    """
    response = drf_exception_handler(exc, context)
    if response is None:
        view = context.get('view')
        if isinstance(exc, DatabaseError):
            # 数据库异常
            logger.error('[%s] %s' % (view, exc))
            response = Response({"message": "Mysql服务器数据库异常"}, status=status.HTTP_507_INSUFFICIENT_STORAGE)
        elif isinstance(exc, RedisError):
            # 数据库异常
            logger.error('[%s] %s' % (view, exc))
            response = Response({"message": "Redis服务器数据库异常"}, status=status.HTTP_507_INSUFFICIENT_STORAGE)
    return response

```

```shell
REST_FRAMEWORK = {
    # 异常处理
    "EXCEPTION_HANDLER": "EmpManagerBackend.utils.exceptions.exception_handler",
}
```

![](https://cdn.nlark.com/yuque/0/2024/png/40552572/1728637334574-397ae101-6767-4468-af23-4316e8c0749b.png)

### 时区配置
```python
LANGUAGE_CODE = "zh-Hans"

TIME_ZONE = "Asia/Shanghai"

USE_I18N = True
# 指定Django是否使用感知的时区
USE_TZ = False
```

### 添加导包路径
创建apps包

![](https://cdn.nlark.com/yuque/0/2024/png/40552572/1728637623990-3bca4208-221c-4ef2-8f62-dae6c5dc0500.png)

```python
# 添加导包路径
sys.path.insert(0, os.path.join(BASE_DIR, 'apps'))
```

![](https://cdn.nlark.com/yuque/0/2024/png/40552572/1728637682418-776622b6-9b9a-4cf3-a48a-4b64586f2287.png)

### 解决跨域问题的配置
`pip install django-cors-headers`

corsheaders

![](https://cdn.nlark.com/yuque/0/2024/png/40552572/1728639617856-90c930e8-dba9-4b55-baff-d43da6433659.png)

`"corsheaders.middleware.CorsMiddleware",`

![](https://cdn.nlark.com/yuque/0/2024/png/40552572/1728639627950-c86384ea-307e-48fd-92fa-e9a932ec2ebe.png)

**添加白名单**

```python
CORS_ORIGIN_WHITELIST = (
    'http://127.0.0.1:8080',
    'http://localhost:8080',
    'http://www.nagle.cn:8080',
    'http://api.nagle.cn:8083'
)

CORS_ALLOW_CREDENTIALS = True  # 允许携带cookie，凡是出现在白名单中的域名，都可以访问后端。

```

### Basemodel
utils/basemodel.py

```python
from django.db import models


class BaseModel(models.Model):
    """
    所有模型的父类，公共属性
    """
    # auto_now_add:插入时添加
    # auto_now:只要更改就添加
    create_time = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    update_time = models.DateTimeField(auto_now=True, verbose_name='修改时间')

    class Meta:
        abstract = True  # 抽象类， 不需要映射

```

### 接口文档-选配
安装 `pip install drf-yasg`

installed_app中配置

![](https://cdn.nlark.com/yuque/0/2025/png/40552572/1737040304424-f7185ad6-7844-4a73-a0f9-2bef6cc01152.png)

路由中配置

```python
schema_view = get_schema_view(
    openapi.Info(
        title="接口API文档",
        default_version='v1',
        description="企业员工管理接口文档",
    ),
    public=True,
    permission_classes=[permissions.AllowAny, ],
)
urlpatterns = [
   path('swagger<format>/', schema_view.without_ui(cache_timeout=0), name='schema-json'),
   path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
   path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
   ...
]
```

[https://drf-yasg.readthedocs.io/en/stable/readme.html](https://drf-yasg.readthedocs.io/en/stable/readme.html)

## 三.系统管理
### 用户管理
创建app`python ../../manage.py startapp emp_manager`

添加到installedApp中

![](https://cdn.nlark.com/yuque/0/2025/png/40552572/1737028498357-68024ce2-c1a9-4637-995a-84b4531127a9.png)

注册路由

![](https://cdn.nlark.com/yuque/0/2025/png/40552572/1737028720047-047cd25f-a0a7-4489-8eb4-caa360439a2d.png)

拷贝路由

#### 用户模型
Django自带的用户模型类：django.contrib.auth.models.User

父类是AbstractUser

+ User对象基本属性
    - 创建用户(注册用户)必选： username、password
    - 创建用户(注册用户)可选：email、first_name、last_name、last_login、date_joined、is_active 、is_staff、is_superuse  
    判断用户是否通过认证(是否登录)：is_authenticated
+ 创建用户(注册用户)的方法  
user = User.objects.create_user(username, email, password,**extra_fields)
+ 用户认证(用户登录)的方法  
from django.contrib.auth import authenticate  
user = authenticate(username=username, password=password, **kwargs)
+ 处理理密码的方法  
设置密码：set_password(raw_password)  
校验密码：check_password(raw_password)
+ 一个可插拔的后台系统 admin

| 字段名 | 字段描述 |
| --- | --- |
| `username` | 必选。150个字符以内。 用户名可能包含字母数字，`_`，`@`，`+``.`和 `-`个字符。 |
| `first_name` | 可选（`blank=True`）。 少于等于30个字符。 |
| `last_name` | 可选（`blank=True`）。 少于等于30个字符。 |
| `email` | 可选（`blank=True`）。 邮箱地址。 |
| `password` | 必选。 密码的哈希加密串。 （Django 不保存原始密码）。 原始密码可以无限长而且可以包含任意字符。 |
| `groups` | 与 `Group`之间的多对多关系。 |
| `user_permissions` | 与 `Permission`之间的多对多关系。 |
| `is_staff` | 布尔值。 设置用户是否可以访问Admin 站点。 |
| `is_active` | 布尔值。 指示用户的账号是否激活。 它不是用来控制用户是否能够登录，而是描述一种帐号的使用状态。 |
| `is_superuser` | 是否是超级用户。超级用户具有所有权限。 |
| `last_login` | 用户最后一次登录的时间。 |
| `date_joined` | 账户创建的时间。 当账号创建时，默认设置为当前的date/time。 |


```python
class UserModel(AbstractUser, BaseModel):
    phone = models.CharField('手机号码', max_length=11, unique=True)
    real_name = models.CharField('真实姓名', max_length=50, blank=True, null=True)

    class Meta:
        db_table = 't_users'
        verbose_name = '用户表'
        verbose_name_plural = verbose_name

    def __str__(self):
        return self.username + ":" + self.real_name
```

配置文件中

```python
# 添加自定义用户模型类(应用名+模型类名）
AUTH_USER_MODEL = 'emp_manager.UserModel'
```

迁移数据库

`python .\manage.py makemigrations`

`python .\manage.py migrate`



#### 短信验证码
```python
"""互亿无线发送短信接口"""
import json
import urllib.parse
import urllib.request

# 接口地址
url = 'http://106.ihuyi.com/webservice/sms.php?method=Submit'


def send_sms(phone, code):
    # 定义请求的数据
    values = {
        'account': os.getenv('SMSCODEID', ""),
        'password': os.getenv('SMSSECRET', ""),
        'mobile': phone,
        'content': '您的验证码是：' + code + '。请不要把验证码泄露给其他人。',
        'format': 'json',
    }
    # 将数据进行编码
    data = urllib.parse.urlencode(values).encode(encoding='UTF8')

    # 发起请求
    req = urllib.request.Request(url, data)
    response = urllib.request.urlopen(req)
    res = response.read()
    return res.decode("utf8")


"""测试代码"""
# 打印结果
if __name__ == '__main__':
    res = send_sms('19292245032', '438934')
    print(type(res)) 
    re_dict = json.loads(res)
    print(re_dict)

```

常量

```python
SMS_CODE_REDIS_EXPIRES = 600  # 短信验证码有效期
SMS_CODE_SEND_LIMIT = 60  # 单个手机号是否发送的标记
```

视图

```python
import json
import logging
import random

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.cache import caches

from EmpManagerBackend.utils.smsCode import send_sms
from emp_manager import constants

logger = logging.getLogger('django')


class SmsCodeView(APIView):

    def get(self, request, mobile):
        # 频繁发送验证码判断
        if caches.get(f'send_flag_{mobile}'):
            return Response(data={"message": "频繁发送验证码"}, status=status.HTTP_400_BAD_REQUEST)

        # 1. 生成验证码
        sms_code = '%06d' % random.randint(1, 999999)
        # 2. redis连接并存储
        cache = caches['verify_code']
        # 验证码10min内有效
        cache.set(f'code_{mobile}', sms_code, constants.SMS_CODE_REDIS_EXPIRES)
        # 重复发送验证码的标记
        cache.set(f'send_flag_{mobile}', 1, constants.SMS_CODE_SEND_LIMIT)
        logger.info(sms_code)
        # 3. 发送短信验证码
        res = json.loads(send_sms(mobile, sms_code))
        if res.get('code') == 2:
            return Response({"message": 'ok'})
        return Response(data={"message": res.get('msg')}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

```

+ <font style="color:rgb(77, 77, 77);">json.dumps() ： 将 Python 对象编码成 JSON 字符串</font>
+ <font style="color:rgb(77, 77, 77);">json.loads() ：将已编码的 JSON 字符串解码为 Python 对象</font>
+ <font style="color:rgb(77, 77, 77);">json.dump() ：将Python内置类型序列化为json对象后写入文件 </font>
+ <font style="color:rgb(77, 77, 77);">json.load() ： 读取文件中json形式的字符串元素转化为</font>[Python类](https://so.csdn.net/so/search?q=Python%E7%B1%BB&spm=1001.2101.3001.7020)<font style="color:rgb(77, 77, 77);">型</font>

路由

```plain
re_path('^user/smsCode/(?P<mobile>1[3-9]\d{9})/$', users_view.SmsCodeView.as_view()),
```

#### 短信验证码-celery
##### 介绍
![](https://cdn.nlark.com/yuque/0/2024/png/40552572/1728641240215-b0208cb8-10ee-4c09-84a1-13de661ec9d7.png)

客户端做的事情：

+ 创建celery示例对象
+ 加载配置（任务存储位置）
+ 只接受什么任务

##### 使用
安装包`pip install celery`

创建文件

![](https://cdn.nlark.com/yuque/0/2025/png/40552572/1737036970339-e29756a8-ea1c-4dc1-b106-87fe4db80c89.png)

celery.py

```python
import os
from celery import Celery

# 1. 导入django配置; 后续便于使用django组件功能

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'EmpManagerBackend.settings.dev')

# os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'EmpManagerBackend.settings.prod')

# 2. 实例化celery对象
app = Celery('django_celery')

# 3. 从django配置文件中导入celery相关的配置; 如果添加 namespace='CELERY' 参数,则celery的配置参数需要添加 "CELERY_" 的前缀
app.config_from_object('django.conf:settings')

# 4. 在django所有应用中自动搜索 tasks.py 文件, 作为任务文件
app.autodiscover_tasks()
```

tasks.py

```python
# 定义任务函数
import json

from celery import shared_task

from EmpManagerBackend.utils.smsCode import send_sms


@shared_task
def send_sms_code(mobile, sms_code):
    """
    发送短信的celery异步任务
    """
    return json.loads(send_sms(mobile, sms_code))

```

配置文件

```python
# ---------------- celery 相关配置 ----------------------
# Broker配置，使用Redis作为消息中间件
BROKER_URL = 'redis://127.0.0.1:6379/1'
# BACKEND配置，使用Redis作为结果仓库
RESULT_BACKEND = 'redis://127.0.0.1:6379/2'
 
# 指定 Celery 能够接受的内容类型列表
ACCEPT_CONTENT = ['json']
# 任务将以json格式进行序列化
TASK_SERIALIZER = 'json'
# 结果以json格式进行序列化存储或传输
RESULT_SERIALIZER = 'json'
# 指定连接重试
broker_connection_retry_on_startup = True
# 任务结果过期时间(单位:秒)
TASK_RESULT_EXPIRES = 60 * 60 * 24
# 时区配置
TIMEZONE = "Asia/Shanghai"
```

![](https://cdn.nlark.com/yuque/0/2025/png/40552572/1737037819963-900bcb49-5402-4495-913e-5b19cef6ecad.png)

命令行启动celery

`celery -A EmpManagerBackend worker -l info`

+ -A：指定启动文件
+ -l：指定日志输出的级别

window中运行需要加上`-P eventlet`,其中eventlet需要通过pip安装

更改django_entrypoint.sh

![](https://cdn.nlark.com/yuque/0/2025/png/40552572/1737037494390-ec58fb8a-7a46-47fd-9fb0-e88e3801e612.png)

更多高级请见：[https://www.cnblogs.com/cs-songbai/p/18335042](https://www.cnblogs.com/cs-songbai/p/18335042)

#### 用户登录


下载

```bash
pip install djangorestframework-simplejwt
```

配置文件中配置

```python
REST_FRAMEWORK = {
    ...
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',  # 加入这个配置项
    )
}
```

installed_app

```python
INSTALLED_APPS = [
    ...
    'rest_framework_simplejwt',
    ...
]
```

JWT相关配置

```python
SIMPLE_JWT = {
    # token有效时长(返回的 access 有效时长)
    'ACCESS_TOKEN_LIFETIME': datetime.timedelta(days=3),
    # token刷新的有效时间(返回的 refresh 有效时长)
    'REFRESH_TOKEN_LIFETIME': datetime.timedelta(days=6),
}
```

路由配置-有关双token的相关知识可以自行查阅

```python
from rest_framework_simplejwt.views import token_obtain_pair, token_refresh

urlpatterns = [
    re_path(r'user/login/', token_obtain_pair, name='token_obtain_pair'),
    # path('api/token/refresh/', token_refresh, name='token_refresh'), # 双token配置-刷新accesstoken的配置
]
```



由于默认的登录情况下，会只返回access_token和refresh_token，如果想登录时返回用户id，用户名等信息，需要配置下响应

在serilalizers里或者utils里配置如下

```python
class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        res_data = {
            # "token": data,  # 双token的配置
            "token": data['access'],
            'id': self.user.id,
            'username': self.user.username
        }
        return res_data
```

然后配置项目配置文件

```python
SIMPLE_JWT = {
    # token有效时长(返回的 access 有效时长)
    'ACCESS_TOKEN_LIFETIME': datetime.timedelta(days=3),
    # token刷新的有效时间(返回的 refresh 有效时长)
    'REFRESH_TOKEN_LIFETIME': datetime.timedelta(days=6),
    # 自定义的返回格式
    # "TOKEN_OBTAIN_SERIALIZER": "users.utils.MyTokenObtainPairSerializer",
    "TOKEN_OBTAIN_SERIALIZER": "users.serializers.MyTokenObtainPairSerializer",  # 替换成你的路径
}
```

#### 用户注册
视图类

```python
class CreateUserView(CreateAPIView):
    """用户注册"""

    serializer_class = CreateUserSerializer
```

序列化类

```python
class CreateUserSerializer(serializers.ModelSerializer):
    """注册的序列化器"""

    # 需要校验的字段id、username、password、phone、sms_code
    # 模型中已存在的字段id、username、password、phone
    # 需要序列化的字段id、username、phone
    sms_code = serializers.CharField(label='验证码', write_only=True)
    phone = serializers.RegexField(r'1[3-9]\d{9}', label='手机号')


    class Meta:
        model = UserModel
        fields = ('id', 'username', 'password', 'phone', 'sms_code')
        extra_kwargs = {
            'username': {
                'min_length': 3,
                'max_length': 20,
                'error_messages': {
                    'min_length': '最少为3位',
                    'max_length': '最长为20位'
                }
            },
            'password': {
                'write_only': True,
                'min_length': 6,
                'max_length': 20,
                'error_messages': {
                    'min_length': '最少为3位',
                    'max_length': '最长为20位'
                }
            },
        }

    def validate(self, attrs):
        # 手机验证码
        cache = caches['verify_code']
        real_sms_code = cache.get('code_%s' % attrs['phone'])
        logger.info(real_sms_code)
        if real_sms_code is None or attrs['sms_code'] != real_sms_code:
            raise serializers.ValidationError('验证码错误')
        count = UserModel.objects.filter(username=attrs['username']).count()
        if count > 0:
            raise serializers.ValidationError('用户名已存在')
        count = UserModel.objects.filter(phone=attrs['phone']).count()
        if count > 0:
            raise serializers.ValidationError('手机号已存在')
        return attrs

    def create(self, validated_data):
        del validated_data['sms_code']  # 删除验证码
        user = UserModel.objects.create_user(**validated_data)
        return user
```

#### 用户查、删、改
自定分页

```python
from rest_framework.pagination import PageNumberPagination


class GlobalPagination(PageNumberPagination):
    # 项目中默认的分页配置
    page_size = 10  # 每页显示条数
    page_size_query_param = 'size'  # 前端发送每页显示的数目
    max_page_size = 100  # 前端最多能够设置每页的数量
```



序列化类

```python
import logging

from django.conf import settings
from django.core.cache import caches
from django.db import transaction
from rest_framework import serializers, mixins
from rest_framework.exceptions import ValidationError
from rest_framework.generics import GenericAPIView
from rest_framework.serializers import ModelSerializer

from emp_manager.models import UserModel, RoleModel
from emp_manager.serializers.dept_ser import DeptBaseSerializer
from emp_manager.serializers.role_ser import RoleSerializer

logger = logging.getLogger('django')


class CreateUserSerializer(serializers.ModelSerializer):
    """注册的序列化器"""

    # 需要校验的字段id、username、password、phone、sms_code
    # 模型中已存在的字段id、username、password、phone
    # 需要序列化的字段id、username、phone
    sms_code = serializers.CharField(label='验证码', write_only=True)
    phone = serializers.RegexField(r'1[3-9]\d{9}', label='手机号')

    class Meta:
        model = UserModel
        fields = ('id', 'username', 'password', 'phone', 'sms_code')
        extra_kwargs = {
            'username': {
                'min_length': 3,
                'max_length': 20,
                'error_messages': {
                    'min_length': '最少为3位',
                    'max_length': '最长为20位'
                }
            },
            'password': {
                'write_only': True,
                'min_length': 6,
                'max_length': 20,
                'error_messages': {
                    'min_length': '最少为3位',
                    'max_length': '最长为20位'
                }
            },
        }

    def validate(self, attrs):
        # 手机验证码
        cache = caches['verify_code']
        real_sms_code = cache.get('code_%s' % attrs['phone'])
        logger.info(real_sms_code)
        if real_sms_code is None or attrs['sms_code'] != real_sms_code:
            raise serializers.ValidationError('验证码错误')
        count = UserModel.objects.filter(username=attrs['username']).count()
        if count > 0:
            raise serializers.ValidationError('用户名已存在')
        count = UserModel.objects.filter(phone=attrs['phone']).count()
        if count > 0:
            raise serializers.ValidationError('手机号已存在')
        return attrs

    def create(self, validated_data):
        del validated_data['sms_code']  # 删除验证码
        user = UserModel.objects.create_user(**validated_data)
        return user


class UserUpdateOrDeleteSerializer(ModelSerializer):
    """"
    只用于修改和删除，包括
    id，phone，real_name,role_id,dept_id，username
    """

    class Meta:
        model = UserModel
        fields = ('id', 'phone', 'real_name', 'roles', 'dept', 'username', 'email')


class UserGetSerializer(ModelSerializer):
    """
    用于查询用户：id，username，phone，real_name,所有角色的详细信息,用户所在部门所在详细信息
    """
    roles = RoleSerializer(many=True, read_only=True)
    dept = DeptBaseSerializer(many=False, read_only=True)

    class Meta:
        model = UserModel
        fields = ('id', 'username', 'phone', 'real_name', 'roles', 'dept', 'email', 'create_time')


class UserRegisterSerializer(ModelSerializer):
    """
    用户注册的序列化类
    """
    phone = serializers.RegexField(r'1[3-9]\d{9}', label='手机号')

    class Meta:
        model = UserModel
        fields = ('id', 'username', 'phone', 'real_name', 'dept', 'roles', 'email')

        extra_kwargs = {
            'username': {
                'max_length': 12,
                'min_length': 2,
            },
        }

    def create(self, validated_data):
        """
        必须重写create函数，用户密码是不能直接插入数据库中的
        """
        with transaction.atomic():
            validated_data['password'] = settings.COMMON_PASSWORD
            roles = validated_data.pop('roles')
            user = UserModel.objects.create_user(**validated_data)
            user.roles.set(roles)
            user.save()
        return user


class ResetPasswordSerializer(ModelSerializer):
    """
    用于修改密码：原密码，新密码
    """
    new_password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = UserModel
        fields = ('id', 'password', 'new_password')
        extra_kwargs = {
            'password': {'write_only': True, 'required': True},
            'new_password': {'write_only': True, 'required': True}
        }

    def save(self, **kwargs):
        """
        必须重写save函数，否则明文的密码会保存到数据库中

        """
        if not self.instance.check_password(self.validated_data.get('password')):
            raise ValidationError('原始密码错误')
        self.instance.set_password(self.validated_data.get('new_password'))
        self.instance.save()
        return self.instance

```

视图类

```python
import json
import logging
import random

from rest_framework import status, mixins
from rest_framework.generics import CreateAPIView, GenericAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.cache import caches
from rest_framework.viewsets import GenericViewSet

from EmpManagerBackend.utils.base_view import MultipleDestroyMixin
from EmpManagerBackend.utils.pagination import GlobalPagination
from emp_manager import constants
from EmpManagerBackend.tasks import send_sms_code
from emp_manager.models import UserModel
from emp_manager.serializers.user_ser import CreateUserSerializer, UserUpdateOrDeleteSerializer, UserGetSerializer, \
    UserRegisterSerializer, ResetPasswordSerializer

logger = logging.getLogger('django')


class SmsCodeView(APIView):

    def get(self, request, mobile):
        cache = caches['verify_code']
        # 频繁发送验证码判断
        if cache.get(f'send_flag_{mobile}'):
            return Response(data={"message": "频繁发送验证码"}, status=status.HTTP_400_BAD_REQUEST)

        # 1. 生成验证码
        sms_code = '%06d' % random.randint(1, 999999)
        # 2. redis连接并存储
        # 验证码10min内有效
        cache.set(f'code_{mobile}', sms_code, constants.SMS_CODE_REDIS_EXPIRES)
        # 重复发送验证码的标记
        cache.set(f'send_flag_{mobile}', 1, constants.SMS_CODE_SEND_LIMIT)
        logger.info(sms_code)
        # 3. 发送短信验证码
        send_sms_code.delay(mobile, sms_code)
        # json.loads(send_sms(mobile, sms_code))
        return Response(data={"message": "短信发送成功"})


class CreateUserView(CreateAPIView):
    """用户注册"""

    serializer_class = CreateUserSerializer


class UserView(mixins.UpdateModelMixin,
               mixins.CreateModelMixin,
               mixins.RetrieveModelMixin,
               mixins.DestroyModelMixin,
               mixins.ListModelMixin,
               GenericViewSet,
               MultipleDestroyMixin):
    queryset = UserModel.objects.all()
    pagination_class = GlobalPagination

    def get_queryset(self):
        pk = self.request.query_params.get('id', None)
        username = self.request.query_params.get('username', None)
        real_name = self.request.query_params.get('real_name', None)
        queryset = UserModel.objects.all()
        if pk:
            queryset = queryset.filter(id=pk)
        if username:
            # queryset = queryset.filter(username__icontains=username)
            queryset = queryset.filter(username__contains=username)
        if real_name:
            queryset = queryset.filter(real_name__contains=real_name)
        return queryset

    def get_serializer_class(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            return UserUpdateOrDeleteSerializer
        elif self.action == 'create':
            return UserRegisterSerializer
        else:
            return UserGetSerializer


class ResetPasswordView(mixins.UpdateModelMixin, GenericAPIView):
    """
    patch:
    用户重置密码

    输入原始密码，新密码，return：修改之后的用户，但不显示密码
    """
    queryset = UserModel.objects.all()
    serializer_class = ResetPasswordSerializer

    def patch(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

```

### 部门管理
#### 部门模型
```python
class DeptModel(BaseModel):
    name = models.CharField(verbose_name='部门名称', max_length=50, unique=True)
    city = models.CharField(verbose_name='部门城市', max_length=50, blank=True, null=True)
    leader_id = models.IntegerField(verbose_name='负责人id', blank=True, null=True)
    leader_name = models.CharField(verbose_name='负责人姓名', blank=True, unique=True, max_length=50)
    parent_dept = models.ForeignKey('self', verbose_name='父部门', related_name='child_dept', on_delete=models.SET_NULL,
                                    null=True, blank=True)

    class Meta:
        db_table = 't_dept'
        verbose_name = '部门表'
        verbose_name_plural = verbose_name

    def __str__(self):
        return self.name
```

#### 部门的增、删、改、查
批量删除的Mixin基类

```python
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response


class MultipleDestroyMixin:
    """
    批量删除的视图函数
    """

    @action(methods=['delete'], detail=False)
    def multiple_destroy(self, request, *args, **kwargs):
        delete_ids = request.data.get('ids')
        if not delete_ids:
            return Response(data={'detail': '参数错误，ids为必传参数'}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(delete_ids, list):
            return Response(data={'detail': 'ids格式错误，应为列表'}, status=status.HTTP_400_BAD_REQUEST)
        queryset = self.get_queryset()
        del_queryset = queryset.filter(id__in=delete_ids)
        if del_queryset.count() != len(delete_ids):
            return Response(data={'detail': '删除数据不存在'}, status=status.HTTP_400_BAD_REQUEST)
        del_queryset.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
```

序列化器类

```python
class DeptBaseSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(format='%Y-%m-%d %H:%M:%S', read_only=True)
    update_time = serializers.DateTimeField(format='%Y-%m-%d %H:%M:%S', read_only=True)

    class Meta:
        model = DeptModel
        fields = '__all__'


class DeptReadOnlySerializer(DeptBaseSerializer):
    child_dept = serializers.SerializerMethodField()

    def get_child_dept(self, obj):
        child_dept = obj.child_dept.all()
        return DeptReadOnlySerializer(child_dept, many=True).data
```

视图类

```python
from rest_framework import viewsets

from EmpManagerBackend.utils.base_view import MultipleDestroyMixin
from emp_manager.models import DeptModel
from emp_manager.serializers.dept_ser import DeptBaseSerializer, DeptReadOnlySerializer


class DeptView(viewsets.ModelViewSet, MultipleDestroyMixin):
    queryset = DeptModel.objects.all()

    # serializer_class = DeptSerializer

    def get_queryset(self):
        """
        请求参数pid。
        没有pid，查询所有部门；
        pid=0，查询顶级部门；
        pid=非0，查询某个父部门下的所有子部门列表
        """
        pid = self.request.query_params.get('pid', None)
        if pid:
            int_pid = int(pid)
            if int_pid == 0:
                return DeptModel.objects.filter(parent_dept__isnull=True)
            else:
                return DeptModel.objects.filter(parent_dept__id=int_pid)
        else:
            return DeptModel.objects.all()

    def get_serializer_class(self):
        if self.action in ['update', 'partial_update', 'destroy', 'create']:
            return DeptBaseSerializer
        else:
            return DeptReadOnlySerializer

```

### 角色管理
#### 角色模型
```python
class RoleModel(BaseModel):
    name = models.CharField(verbose_name='角色名称', max_length=50, unique=True)

    class Meta:
        db_table = 't_role'
        verbose_name = '角色表'
        verbose_name_plural = verbose_name

    def __str__(self):
        return self.name
```

用户模型更新

```python
class UserModel(AbstractUser, BaseModel):
    phone = models.CharField('手机号码', max_length=11, unique=True)
    real_name = models.CharField('真实姓名', max_length=50, blank=True, null=True)
    dept = models.ForeignKey('DeptModel', verbose_name='用户所在部门', on_delete=models.SET_NULL, null=True, blank=True)
    roles = models.ManyToManyField('RoleModel', db_table='t_user_role', blank=True, null=True)

```

#### 角色的增、删、改、查
