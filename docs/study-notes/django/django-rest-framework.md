# 11 Django REST Framework(DRF)

前后端分离是主流架构:Django 提供 JSON API,前端(Web/App/小程序)消费。DRF 是 Django 官方钦定的 API 框架。本章整合 DRF 视图组件专项文档,并补上序列化器、认证权限、分页过滤等完整链路。

## 11.1 DRF 是什么

```bash
pip install djangorestframework
```

```python
# settings.py
INSTALLED_APPS = [
    ...,
    'rest_framework',
]

REST_FRAMEWORK = {                       # DRF 全局配置
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',   # 浏览器会话
        'rest_framework.authentication.TokenAuthentication',     # Token
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',  # 默认权限
    ],
}
```

**DRF 解决的问题:** JSON 解析/序列化、参数校验、认证(JWT/Session/Token)、权限、限流、分页、过滤、自动 API 文档(browsable API)—— 把 02/06 章手写 JSON 接口的苦活全部标准化。

## 11.2 序列化器(Serializer):核心中的核心

序列化器 ≈ DRF 的表单:定义"数据 ↔ Python 对象"的转换与校验规则。

### ModelSerializer

```python
# bookstore/serializers.py
from rest_framework import serializers
from .models import Book, Press

class PressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Press
        fields = ['id', 'name', 'site']

class BookSerializer(serializers.ModelSerializer):
    # 外键默认输出主键;嵌套序列化器输出完整对象(读)
    press_detail = PressSerializer(source='press', read_only=True)
    # 自定义方法字段
    price_with_tax = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = ['id', 'title', 'price', 'press', 'press_detail', 'price_with_tax']
        # read_only_fields = ['id']         # 只读字段
        # extra_kwargs = {'price': {'min_value': 0}}

    def get_price_with_tax(self, obj):
        return round(obj.price * 1.13, 2)

    # 字段级校验:validate_<字段名>
    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("价格必须大于 0")
        return value

    # 对象级校验
    def validate(self, attrs):
        if attrs.get('is_onsale') and attrs['price'] <= 0:
            raise serializers.ValidationError("在售商品价格必须大于 0")
        return attrs
```

### 序列化器两种用法

```python
# 1. 序列化(输出):模型对象 → dict/JSON
serializer = BookSerializer(book)                 # 单对象
serializer = BookSerializer(books, many=True)     # 列表
serializer.data                                   # {'id': 1, 'title': ...}

# 2. 反序列化(输入):dict → 校验 → 保存
serializer = BookSerializer(data=request.data)
if serializer.is_valid():
    book = serializer.save()                      # 调用 create()
# 更新:serializer = BookSerializer(instance=book, data=request.data)
#       serializer.save() → 调用 update()
# 错误信息:serializer.errors → {'price': ['价格必须大于 0']}
```

### 创建/更新逻辑定制

```python
class BookSerializer(serializers.ModelSerializer):
    class Meta:
        model = Book
        fields = ['id', 'title', 'price', 'press']

    def create(self, validated_data):
        # 默认 Book.objects.create(**validated_data);定制:
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # 默认逐字段赋值;定制:
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
```

> `self.context['request']` 由视图自动注入,序列化器里拿当前用户的标准姿势。

## 11.3 视图组件体系(专项文档整合)

DRF 视图分四层,由低到高封装程度递增。**选择原则:够用即止,但团队内统一层级。**

### 第一层:APIView(最基础,全手动)

继承 Django 的 View;使用 DRF 的 Request/Response;自动处理 APIException;内置认证/权限/限流流程。

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

class UserAPIView(APIView):
    def get(self, request):
        # request.data:解析后的 JSON/表单;request.query_params:GET 参数
        return Response({"data": "GET response"})

    def post(self, request):
        return Response({"received": request.data}, status=status.HTTP_201_CREATED)
```

框架流程方法(通常不重写):`dispatch()`(入口)、`check_permissions()`、`check_throttles()`。

### 第二层:GenericAPIView(工具集,半自动)

提供查询集、对象查找、序列化器管理的通用能力:

| 属性/方法 | 作用 |
| --- | --- |
| `queryset` | 基础查询集(必填) |
| `serializer_class` | 序列化器类(必填) |
| `lookup_field = 'pk'` | 单对象查找字段 |
| `get_queryset()` | 获取查询集(重写实现按用户过滤等) |
| `get_object()` | 按 pk 查单对象(404 自动处理) |
| `get_serializer()` | 获取序列化器实例 |
| `filter_queryset()` | 执行过滤后端 |
| `paginate_queryset()` | 分页 |

```python
from rest_framework.generics import GenericAPIView

class ProductDetailView(GenericAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

    def get(self, request, pk):
        instance = self.get_object()                    # 自动 404
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
```

### 第三层:Mixin + GenericAPIView(组合自由)

| Mixin | 核心方法 | 执行流程 | 可扩展钩子 |
| --- | --- | --- | --- |
| CreateModelMixin | `.create()` | 序列化器 → 校验 → 保存 | `perform_create()` |
| ListModelMixin | `.list()` | 过滤 → 分页 → 序列化 | — |
| RetrieveModelMixin | `.retrieve()` | 取对象 → 序列化 | — |
| UpdateModelMixin | `.update()` | 取对象 → 校验 → 保存 | `perform_update()` |
| DestroyModelMixin | `.destroy()` | 取对象 → 删除 | `perform_destroy()` |

```python
from rest_framework.mixins import CreateModelMixin, ListModelMixin
from rest_framework.generics import GenericAPIView

class ProductView(CreateModelMixin, ListModelMixin, GenericAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

    def get(self, request, *args, **kwargs):
        return self.list(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        return self.create(request, *args, **kwargs)

    def perform_create(self, serializer):      # 保存前钩子
        serializer.save(owner=self.request.user)
```

### 第四层:具体通用视图(最省事)

| 视图类 | Mixins | HTTP 方法 | 场景 |
| --- | --- | --- | --- |
| `ListAPIView` | List | GET | 列表 |
| `CreateAPIView` | Create | POST | 创建 |
| `RetrieveAPIView` | Retrieve | GET | 详情 |
| `UpdateAPIView` | Update | PUT/PATCH | 更新 |
| `DestroyAPIView` | Destroy | DELETE | 删除 |
| `ListCreateAPIView` | List+Create | GET, POST | 资源集合 |
| `RetrieveUpdateDestroyAPIView` | R+U+D | GET/PUT/PATCH/DELETE | 详情页管理 |

```python
from rest_framework.generics import RetrieveUpdateDestroyAPIView, ListCreateAPIView

class ProductListView(ListCreateAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

class ProductDetailView(RetrieveUpdateDestroyAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    lookup_field = 'slug'                      # 默认 pk,可换

    def perform_destroy(self, instance):
        instance.is_deleted = True             # 软删除
        instance.save()
```

## 11.4 视图集(ViewSet + Router):资源 API 全家桶

### 视图集对比

| 视图集 | 父类 | 默认动作 | 说明 |
| --- | --- | --- | --- |
| `ViewSet` | ViewSetMixin + APIView | 无 | 全手动 |
| `GenericViewSet` | ViewSetMixin + GenericAPIView | 无 | 需组合 Mixin |
| `ReadOnlyModelViewSet` | R+L+GenericViewSet | retrieve, list | 只读 |
| `ModelViewSet` | C+R+U+D+L | 全 CRUD | **最常用** |

```python
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    # 自定义动作:detail=True 挂单对象,False 挂集合
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        user = self.get_object()
        user.is_active = True
        user.save()
        return Response({'status': 'activated'})

    @action(detail=False, methods=['get'])
    def recent_users(self, request):
        qs = self.queryset.order_by('-last_login')[:5]
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
```

### 路由注册

```python
# urls.py
from rest_framework.routers import DefaultRouter
from .views import UserViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    path('api/', include(router.urls)),
    # 自动生成:
    # GET    /api/users/             → list
    # POST   /api/users/             → create
    # GET    /api/users/{pk}/        → retrieve
    # PUT/PATCH/DELETE /api/users/{pk}/
    # POST   /api/users/{pk}/activate/     → 自定义
    # GET    /api/users/recent_users/      → 自定义
]
```

## 11.5 进阶技巧(专项文档整合)

### 动态序列化器(列表用简版,详情用全版)

```python
class ProductViewSet(viewsets.ModelViewSet):
    def get_serializer_class(self):
        if self.action == 'list':
            return ProductListSerializer
        return ProductDetailSerializer
```

### 按用户过滤数据(安全关键!)

```python
class OrderViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        # 绝不返回别人的订单;request.user 由认证注入
        return Order.objects.filter(user=self.request.user).prefetch_related('items')
```

### 权限控制模板

```python
from rest_framework.permissions import IsAuthenticated, DjangoModelPermissions

class ProjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, DjangoModelPermissions]
    # 需登录 + 按 Django 模型权限(add/change/delete)控制
```

## 11.6 认证与权限

### 认证(Authentication):你是谁

| 认证类 | 适用 |
| --- | --- |
| `SessionAuthentication` | 浏览器场景,依赖 CSRF |
| `TokenAuthentication` | 简单 Token(需建 token 表) |
| `JWTAuthentication`(simplejwt 库) | **前后端分离主流** |
| `BasicAuthentication` | 内部工具 |

```bash
pip install djangorestframework-simplejwt
```

```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
}

# urls.py —— 登录换 token
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns += [
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
# 前端:POST /api/token/ {username, password} → {access, refresh}
# 之后请求头:Authorization: Bearer <access>
```

### 权限(Permission):你能干什么

| 权限类 | 含义 |
| --- | --- |
| `AllowAny` | 任何人(公开接口) |
| `IsAuthenticated` | 已登录 |
| `IsAdminUser` | 管理员 |
| `IsAuthenticatedOrReadOnly` | 登录可写,匿名只读 |
| `DjangoModelPermissions` | 按模型权限 |
| 自定义 | 继承 BasePermission 重写 has_permission/has_object_permission |

```python
from rest_framework.permissions import BasePermission

class IsOwnerOrReadOnly(BasePermission):
    """对象级权限:只有创建者能改"""
    def has_object_permission(self, request, view, obj):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return obj.user == request.user

# 视图级:permission_classes = [IsAuthenticated]
# 全局:settings 里 DEFAULT_PERMISSION_CLASSES
```

### 限流(Throttle)

```python
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_CLASSES': ['rest_framework.throttling.AnonRateThrottle'],
    'DEFAULT_THROTTLE_RATES': {'anon': '100/hour'},   # 匿名 100 次/小时
}

# 视图级:throttle_classes = [UserRateThrottle](自定义按用户限流)
```

## 11.7 分页、过滤与排序

```python
# 全局:
REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,     # ?page=2 翻页;响应带 count/next/previous/results
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
}

# 视图级:
from django_filters.rest_framework import DjangoFilterBackend

class BookViewSet(viewsets.ModelViewSet):
    queryset = Book.objects.all()
    serializer_class = BookSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['press', 'is_onsale']      # ?press=1&is_onsale=true
    search_fields = ['title', 'press__name']       # ?search=python
    ordering_fields = ['price', 'created_at']      # ?ordering=-price
```

## 11.8 设计原则速查(专项文档总结)

| 需求 | 选择 |
| --- | --- |
| 高度定制、流程特殊 | APIView |
| 灵活组合标准操作 | GenericAPIView + Mixins |
| 标准 CRUD 快速交付 | ListCreateAPIView 等具体通用视图 / ModelViewSet |
| 一套资源全量接口 | ViewSet + Router |

## 11.9 实战要点

1. **序列化器永远定义 validate**:输入校验是 API 的第一道防线
2. **get_queryset 必须做数据隔离**(11.5),否则水平越权
3. **响应模型与输入模型分离**(list/detail 用不同 serializer)
4. JWT:access 短过期(15~30min)+ refresh 长过期;登出用黑名单(simplejwt 支持)
5. 开启 `rest_framework.authentication.SessionAuthentication` 时注意 CSRF;纯 JWT 无此问题
6. 大列表必须分页;搜索用 SearchFilter;`select_related` 优化序列化 N+1(04 章)
7. 接口文档:browsable API 开发用;`drf-spectacular` 生成 OpenAPI 给前端
8. 限流 + 权限 + 认证三层都配齐,公开接口显式 `AllowAny`
