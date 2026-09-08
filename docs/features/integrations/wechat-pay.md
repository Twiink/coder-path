# 微信支付接入指南

完整的微信支付接入方案，包括公众号支付、小程序支付和 H5 支付。

## 📋 支付类型

| 支付类型 | 适用场景 | 开发难度 |
|---------|---------|---------|
| 公众号支付 | 微信公众号内网页 | ⭐⭐ |
| 小程序支付 | 微信小程序 | ⭐⭐ |
| H5 支付 | 手机浏览器 | ⭐⭐ |
| APP 支付 | 原生 APP | ⭐⭐⭐ |
| Native 支付 | PC 网站扫码支付 | ⭐⭐ |

## 🔧 前置准备

### 1. 申请资质

- [ ] 注册微信商户号
- [ ] 完成资质认证
- [ ] 签约微信支付产品

### 2. 获取配置信息

登录[微信商户平台](https://pay.weixin.qq.com/)获取：

- **AppID**：公众号/小程序的唯一标识
- **商户号（mch_id）**：商户平台分配的商户号
- **API 密钥（key）**：用于签名验证，32 位字符串
- **API 证书**：用于退款等敏感操作

### 3. 配置支付目录

在商户平台设置支付授权目录（公众号支付）或域名白名单（H5 支付）。

## 💻 公众号支付实现

### 后端实现（Python + Django）

#### 1. 安装依赖

```bash
pip install requests pycryptodome
```

#### 2. 配置文件

```python
# settings.py
WECHAT_PAY_CONFIG = {
    'appid': 'your_appid',
    'mch_id': 'your_mch_id',
    'key': 'your_api_key',
    'notify_url': 'https://yourdomain.com/api/wechat/notify/',
    'cert_path': '/path/to/apiclient_cert.pem',
    'key_path': '/path/to/apiclient_key.pem',
}
```

#### 3. 工具函数

```python
# utils/wechat_pay.py
import time
import hashlib
import random
import string
import requests
from xml.etree import ElementTree as ET
from django.conf import settings

class WechatPay:
    def __init__(self):
        self.config = settings.WECHAT_PAY_CONFIG
        self.api_url = 'https://api.mch.weixin.qq.com'
    
    def generate_nonce_str(self, length=32):
        """生成随机字符串"""
        return ''.join(random.choices(string.ascii_letters + string.digits, k=length))
    
    def generate_sign(self, params):
        """生成签名"""
        # 1. 参数排序
        sorted_params = sorted(params.items(), key=lambda x: x[0])
        
        # 2. 拼接字符串
        string_sign_temp = '&'.join([f'{k}={v}' for k, v in sorted_params if v])
        string_sign_temp += f'&key={self.config["key"]}'
        
        # 3. MD5 加密并转为大写
        sign = hashlib.md5(string_sign_temp.encode('utf-8')).hexdigest().upper()
        return sign
    
    def dict_to_xml(self, data):
        """字典转 XML"""
        xml = ['<xml>']
        for k, v in data.items():
            xml.append(f'<{k}><![CDATA[{v}]]></{k}>')
        xml.append('</xml>')
        return ''.join(xml)
    
    def xml_to_dict(self, xml_str):
        """XML 转字典"""
        root = ET.fromstring(xml_str)
        return {child.tag: child.text for child in root}
    
    def unified_order(self, order_data):
        """统一下单接口"""
        params = {
            'appid': self.config['appid'],
            'mch_id': self.config['mch_id'],
            'nonce_str': self.generate_nonce_str(),
            'body': order_data['body'],  # 商品描述
            'out_trade_no': order_data['out_trade_no'],  # 商户订单号
            'total_fee': order_data['total_fee'],  # 总金额（分）
            'spbill_create_ip': order_data['client_ip'],
            'notify_url': self.config['notify_url'],
            'trade_type': 'JSAPI',
            'openid': order_data['openid'],  # 用户 openid
        }
        
        # 生成签名
        params['sign'] = self.generate_sign(params)
        
        # 发起请求
        xml_data = self.dict_to_xml(params)
        response = requests.post(
            f'{self.api_url}/pay/unifiedorder',
            data=xml_data.encode('utf-8'),
            headers={'Content-Type': 'application/xml'}
        )
        
        # 解析响应
        result = self.xml_to_dict(response.text)
        
        if result.get('return_code') == 'SUCCESS' and result.get('result_code') == 'SUCCESS':
            return {
                'prepay_id': result['prepay_id'],
                'code_url': result.get('code_url'),  # Native 支付二维码链接
            }
        else:
            raise Exception(f"统一下单失败: {result.get('err_code_des', '未知错误')}")
    
    def generate_pay_params(self, prepay_id):
        """生成前端调起支付所需参数"""
        timestamp = str(int(time.time()))
        nonce_str = self.generate_nonce_str()
        
        params = {
            'appId': self.config['appid'],
            'timeStamp': timestamp,
            'nonceStr': nonce_str,
            'package': f'prepay_id={prepay_id}',
            'signType': 'MD5',
        }
        
        params['paySign'] = self.generate_sign(params)
        return params
    
    def verify_notify(self, xml_data):
        """验证支付通知"""
        data = self.xml_to_dict(xml_data)
        
        # 验证签名
        sign = data.pop('sign', None)
        calculated_sign = self.generate_sign(data)
        
        if sign != calculated_sign:
            return None, '签名验证失败'
        
        return data, None
    
    def refund(self, refund_data):
        """申请退款"""
        params = {
            'appid': self.config['appid'],
            'mch_id': self.config['mch_id'],
            'nonce_str': self.generate_nonce_str(),
            'out_trade_no': refund_data['out_trade_no'],
            'out_refund_no': refund_data['out_refund_no'],
            'total_fee': refund_data['total_fee'],
            'refund_fee': refund_data['refund_fee'],
            'notify_url': refund_data.get('notify_url'),
        }
        
        params['sign'] = self.generate_sign(params)
        xml_data = self.dict_to_xml(params)
        
        # 使用证书发起请求
        response = requests.post(
            f'{self.api_url}/secapi/pay/refund',
            data=xml_data.encode('utf-8'),
            cert=(self.config['cert_path'], self.config['key_path']),
            headers={'Content-Type': 'application/xml'}
        )
        
        result = self.xml_to_dict(response.text)
        
        if result.get('return_code') == 'SUCCESS' and result.get('result_code') == 'SUCCESS':
            return result
        else:
            raise Exception(f"退款失败: {result.get('err_code_des', '未知错误')}")
```

#### 4. 视图函数

```python
# views/wechat_pay.py
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from utils.wechat_pay import WechatPay
import json

@require_http_methods(['POST'])
def create_order(request):
    """创建支付订单"""
    try:
        data = json.loads(request.body)
        
        # 创建订单记录
        order = Order.objects.create(
            user=request.user,
            order_no=generate_order_no(),
            amount=data['amount'],
            product_name=data['product_name'],
        )
        
        # 调用微信统一下单
        wechat_pay = WechatPay()
        result = wechat_pay.unified_order({
            'body': data['product_name'],
            'out_trade_no': order.order_no,
            'total_fee': int(order.amount * 100),  # 转为分
            'client_ip': get_client_ip(request),
            'openid': request.user.wechat_openid,
        })
        
        # 生成前端调起支付的参数
        pay_params = wechat_pay.generate_pay_params(result['prepay_id'])
        
        return JsonResponse({
            'code': 0,
            'message': '成功',
            'data': {
                'order_no': order.order_no,
                'pay_params': pay_params,
            }
        })
    
    except Exception as e:
        return JsonResponse({
            'code': -1,
            'message': str(e)
        }, status=400)

@csrf_exempt
@require_http_methods(['POST'])
def payment_notify(request):
    """支付结果通知"""
    try:
        xml_data = request.body.decode('utf-8')
        
        wechat_pay = WechatPay()
        data, error = wechat_pay.verify_notify(xml_data)
        
        if error:
            return HttpResponse(
                '<xml><return_code><![CDATA[FAIL]]></return_code>'
                f'<return_msg><![CDATA[{error}]]></return_msg></xml>',
                content_type='application/xml'
            )
        
        # 处理支付成功逻辑
        if data['result_code'] == 'SUCCESS':
            order = Order.objects.get(order_no=data['out_trade_no'])
            if order.status == 'pending':
                order.status = 'paid'
                order.transaction_id = data['transaction_id']
                order.save()
                
                # 触发后续业务逻辑
                handle_payment_success(order)
        
        return HttpResponse(
            '<xml><return_code><![CDATA[SUCCESS]]></return_code>'
            '<return_msg><![CDATA[OK]]></return_msg></xml>',
            content_type='application/xml'
        )
    
    except Exception as e:
        print(f'支付通知处理失败: {e}')
        return HttpResponse(
            '<xml><return_code><![CDATA[FAIL]]></return_code>'
            '<return_msg><![CDATA[系统错误]]></return_msg></xml>',
            content_type='application/xml'
        )
```

### 前端实现（JavaScript）

```javascript
// 调起微信支付
async function wxPay(orderData) {
  try {
    // 1. 创建订单
    const response = await fetch('/api/wechat/create-order/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });
    
    const result = await response.json();
    
    if (result.code !== 0) {
      throw new Error(result.message);
    }
    
    // 2. 调起微信支付
    const payParams = result.data.pay_params;
    
    if (typeof WeixinJSBridge === 'undefined') {
      alert('请在微信浏览器中打开');
      return;
    }
    
    WeixinJSBridge.invoke('getBrandWCPayRequest', {
      appId: payParams.appId,
      timeStamp: payParams.timeStamp,
      nonceStr: payParams.nonceStr,
      package: payParams.package,
      signType: payParams.signType,
      paySign: payParams.paySign,
    }, (res) => {
      if (res.err_msg === 'get_brand_wcpay_request:ok') {
        // 支付成功
        console.log('支付成功');
        // 跳转到成功页面或轮询订单状态
        checkPaymentStatus(result.data.order_no);
      } else if (res.err_msg === 'get_brand_wcpay_request:cancel') {
        // 用户取消支付
        console.log('用户取消支付');
      } else {
        // 支付失败
        console.log('支付失败:', res.err_msg);
      }
    });
  } catch (error) {
    console.error('支付失败:', error);
    alert(`支付失败: ${error.message}`);
  }
}

// 检查支付状态
async function checkPaymentStatus(orderNo) {
  const maxAttempts = 10;
  let attempts = 0;
  
  const check = async () => {
    attempts++;
    
    const response = await fetch(`/api/orders/${orderNo}/status/`);
    const result = await response.json();
    
    if (result.status === 'paid') {
      // 支付成功，跳转
      window.location.href = `/order/success?order_no=${orderNo}`;
    } else if (attempts < maxAttempts) {
      // 继续轮询
      setTimeout(check, 2000);
    } else {
      // 超时，提示用户
      alert('支付状态确认超时，请稍后查看订单');
    }
  };
  
  check();
}
```

## 📝 注意事项

### 安全相关

1. **签名验证**：所有请求和回调都必须验证签名
2. **HTTPS**：生产环境必须使用 HTTPS
3. **密钥保护**：API 密钥和证书严格保密，不要提交到代码仓库
4. **幂等性**：支付通知可能重复，需要做幂等处理

### 常见问题

#### 1. 签名错误
- 检查参数是否按字典序排序
- 确认 key 是否正确
- 检查参数值是否有空格或特殊字符

#### 2. 支付目录配置错误
- 确保支付页面 URL 在配置的目录下
- 目录必须精确到最后一级，以 / 结尾

#### 3. redirect_url 参数错误
- H5 支付必须传递 redirect_url
- URL 必须进行 URLencode
- 域名必须在商户平台白名单中

#### 4. 支付通知收不到
- 检查 notify_url 是否可公网访问
- 确认服务器没有防火墙阻拦
- 检查响应格式是否正确

## 🧪 测试建议

### 1. 使用沙箱环境

微信支付提供沙箱环境用于测试，参考[官方文档](https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=23_1)。

### 2. 测试用例

- ✅ 正常支付流程
- ✅ 用户取消支付
- ✅ 支付超时
- ✅ 网络异常
- ✅ 重复支付
- ✅ 退款流程

### 3. 日志记录

记录所有关键操作，便于问题排查：

```python
import logging

logger = logging.getLogger('wechat_pay')

# 记录请求
logger.info(f'统一下单请求: {params}')

# 记录响应
logger.info(f'统一下单响应: {result}')

# 记录异常
logger.error(f'支付异常: {str(e)}', exc_info=True)
```

## 📚 参考资源

- [微信支付官方文档](https://pay.weixin.qq.com/wiki/doc/api/index.html)
- [微信公众平台](https://mp.weixin.qq.com/)
- [微信商户平台](https://pay.weixin.qq.com/)

---

> **提示**：本文档持续更新，如有问题欢迎反馈。在正式上线前，务必在沙箱环境充分测试！
