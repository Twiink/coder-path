# 08 Admin 后台管理

Django Admin 是框架的王牌功能:注册模型后自动获得一套带增删改查、搜索、过滤的数据管理后台。本章整合原笔记 admin 部分与后台管理专项文档,给出生产级配置。

## 8.1 快速接入

### 1. 确保 admin 已启用(默认启用)

```python
# settings.py
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',          # admin 依赖
    'django.contrib.sessions',
    'django.contrib.messages',
    ...
]
# urls.py
from django.contrib import admin
urlpatterns = [path('admin/', admin.site.urls)]
```

### 2. 初始化数据库 + 创建管理员

```bash
python manage.py migrate
python manage.py createsuperuser
# Username: admin
# Email: ...
# Password: (密码强度有校验)
```

访问 http://127.0.0.1:8000/admin/ 登录即可看到内置的 User/Group 管理。

### 3. 注册自己的模型

```python
# bookstore/admin.py
from django.contrib import admin
from .models import Book

admin.site.register(Book)     # 最小注册:列表显示 Book object (N)
```

列表页显示 `Book object (1)` 不友好 —— 模型里加 `__str__`:

```python
class Book(models.Model):
    ...
    def __str__(self):
        return f"{self.title}({self.price}元)"
```

## 8.2 ModelAdmin:后台展示的完整控制

```python
from django.contrib import admin
from .models import Book, Press

@admin.register(Book)          # 装饰器注册(等价于 admin.site.register(Book, BookAdmin))
class BookAdmin(admin.ModelAdmin):
    # ---- 列表页 ----
    list_display = ('id', 'title', 'price', 'press', 'is_onsale', 'created_at')
    list_display_links = ('id', 'title')          # 哪些列可点击进入详情
    list_editable = ('is_onsale',)                # 列表页直接编辑(注意与 links 冲突)
    list_filter = ('press', 'is_onsale', 'created_at')   # 右侧过滤器
    search_fields = ('title', 'press__name')      # 搜索框(支持关联字段 __)
    ordering = ('-created_at',)                   # 列表排序
    list_per_page = 50                            # 每页条数(默认 100)
    date_hierarchy = 'created_at'                 # 按日期钻取导航
    empty_value_display = '--'                    # 空值显示

    # 只读字段(详情页不可改)
    readonly_fields = ('created_at', 'updated_at')

    # ---- 表单页(添加/编辑)----
    fields = (('title', 'price'), 'press', 'is_onsale')   # 字段与分组布局(元组=同一行)
    exclude = ('slug',)                           # 排除字段
    save_on_top = True                            # 顶部也放保存按钮(长表单好用)

    # ---- 外键/大数据量字段 ----
    raw_id_fields = ('press',)                    # 外键用 id 输入框(选项太多时防卡死)
    autocomplete_fields = ('press',)              # 搜索式下拉(需被选模型有 search_fields)
    filter_horizontal = ('tags',)                 # 多对多:左右穿梭控件
    radio_fields = {'press': admin.VERTICAL}      # 单选改 radio
```

### ModelAdmin 常用方法(进阶定制)

```python
class BookAdmin(admin.ModelAdmin):
    list_display = ('title', 'price', 'sales_rank')

    @admin.display(description='销量等级', ordering='sales')   # 可排序 + 列名
    def sales_rank(self, obj):
        return '爆款' if obj.sales > 10000 else '普通'

    def get_queryset(self, request):
        """限制当前管理员能看到的范围(按组过滤数据)"""
        qs = super().get_queryset(request)
        if not request.user.is_superuser:
            qs = qs.filter(press__owner=request.user)
        return qs

    def save_model(self, request, obj, form, change):
        """保存时注入当前用户(审计字段)"""
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
```

## 8.3 行内编辑(InlineModelAdmin)

一对多关系的经典展示:编辑出版社时直接管理旗下图书。

```python
class BookInline(admin.TabularInline):        # 表格行式;StackedInline 是卡片式
    model = Book
    extra = 1                                 # 默认展示的空行数
    fields = ('title', 'price', 'is_onsale')
    show_change_link = True                   # 行内可跳转到详情页
    # fk_name:多个外键指向同一模型时指定用哪个

@admin.register(Press)
class PressAdmin(admin.ModelAdmin):
    inlines = [BookInline]
```

## 8.4 自定义后台动作(Actions)

```python
from django.contrib import messages

@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    actions = ['make_onsale', 'mark_out_of_stock']

    @admin.action(description='批量上架所选图书')     # 动作在下拉框的显示名
    def make_onsale(self, request, queryset):
        updated = queryset.update(is_onsale=True)
        self.message_user(request, f'已上架 {updated} 本书')       # 页面顶部提示

    @admin.action(description='标记为停售(危险操作)')
    def mark_out_of_stock(self, request, queryset):
        queryset.update(is_onsale=False)

# 全局动作(所有模型可用)放 admin.site.add_action(...)
```

## 8.5 站点级定制

```python
# 任一 admin.py
from django.contrib import admin

admin.site.site_header = '书店管理系统'        # 页面左上角标题
admin.site.site_title = '书店后台'             # 浏览器标签标题
admin.site.index_title = '数据管理'            # 首页欢迎语
admin.site.site_url = '/dashboard/'           # "查看站点"链接地址
```

## 8.6 后台安全加固(生产必做)

1. **改掉默认 URL**:`path('admin/', ...)` 改为随机路径(如 `path('manage-secret/', ...)`),降低扫描器命中率
2. **管理员最小化**:业务人员用 `is_staff=True` 但非 superuser,并配组权限;超级管理员账号数量控制
3. **敏感字段不暴露**:`readonly_fields` 锁审计字段;`exclude` 藏内部字段
4. **数据范围隔离**:`get_queryset` 按用户过滤(8.2 示例)
5. **登录限流**:Nginx 层对 admin 路径限流(12 章);或 django-ratelimit
6. **HTTPS 强制** + `SESSION_COOKIE_SECURE = True`(07 章)
7. 生产环境 `collectstatic` 后由 Nginx 服务 admin 静态文件(12 章)

## 8.7 权限与使用边界

Admin 的权限体系(06 章的三层模型)在后台默认生效:`add/change/delete/view` 四类模型权限 + 组。

**边界认知:** Admin 适合**内部运营/管理**场景,不要试图做成面向最终用户的系统 —— 复杂交互、多角色页面、性能敏感场景,应开发自己的页面(模板 + 视图,05/06 章)或 API(11 章),Admin 作为运维兜底工具。

## 8.8 常见问题

**Q1:模型改了,后台看不到变化?**
迁移没执行(`makemigrations` + `migrate`);或应用没注册。

**Q2:列表页点开 504/很慢?**
`list_display` 里有 N+1 查询:给关联字段在 `get_queryset` 里加 `select_related`/`prefetch_related`。

**Q3:外键下拉有十万条选项,页面卡死?**
`raw_id_fields` 或 `autocomplete_fields`(8.2)。

**Q4:图片字段想看到缩略图?**

```python
from django.utils.html import format_html

class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'image_preview')

    @admin.display(description='图片')
    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" height="40"/>', obj.image.url)
        return '-'
```

## 8.9 官方资料

- Django Admin 文档:https://docs.djangoproject.com/zh-hans/ref/contrib/admin/
- ModelAdmin 全部选项:https://docs.djangoproject.com/zh-hans/ref/contrib/admin/#modeladmin-options
