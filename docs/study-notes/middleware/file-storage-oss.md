---
created: 2024-01-20
updated: 2024-01-20
parent: "[[后端/Java/Java学习笔记总索引]]"
tags:
  - Java
  - 文件存储
  - OSS
  - MinIO
  - 分片上传
---

# 文件存储与OSS

> **核心定位**：文件上传是 Web 应用的基础能力，本文覆盖本地存储、阿里 OSS、MinIO 三种方案，以及分片上传、断点续传、图片处理等高级特性。

## 1. 文件存储方案对比

```
┌─────────────────────────────────────────────┐
│ 文件存储方案对比                              │
├─────────────────────────────────────────────┤
│ 本地磁盘：                                    │
│   - 最简单，无额外依赖                       │
│   - 缺点：无法水平扩展、单点故障              │
│   - 适用：小型项目、临时文件                  │
│                                              │
│ 阿里 OSS / 七牛云 / 腾讯 COS：               │
│   - ★ 云存储，高可用、无限容量                │
│   - CDN 加速、图片处理                       │
│   - 适合：生产环境、面向公网                  │
│                                              │
│ ★ MinIO（自建 S3 兼容存储）：                │
│   - 开源免费，S3 API 兼容                    │
│   - 可水平扩展、多副本                       │
│   - ★ 适合：私有云、离线环境、成本敏感场景    │
│                                              │
│ FastDFS：                                    │
│   - 老牌分布式文件系统                       │
│   - 已逐渐被 MinIO/OSS 替代                  │
└─────────────────────────────────────────────┘
```

## 2. 本地文件上传

```java
@Service
public class LocalFileService {
    
    @Value("${file.upload-path}")
    private String uploadPath;
    
    @Value("${file.allowed-types}")
    private String[] allowedTypes;
    
    @Value("${file.max-size}")
    private long maxSize;
    
    /**
     * 单文件上传
     */
    public FileInfo upload(MultipartFile file) throws IOException {
        // 1. 校验
        validateFile(file);
        
        // 2. 生成安全文件名
        String originalName = file.getOriginalFilename();
        String ext = FilenameUtils.getExtension(originalName);
        String newName = UUID.randomUUID().toString().replace("-", "") + "." + ext;
        
        // 3. 按日期分目录
        String datePath = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM/dd"));
        Path targetDir = Paths.get(uploadPath, datePath);
        Files.createDirectories(targetDir);
        Path targetPath = targetDir.resolve(newName);
        
        // 4. 写入（流式，不占内存）
        try (InputStream is = file.getInputStream()) {
            Files.copy(is, targetPath, StandardCopyOption.REPLACE_EXISTING);
        }
        
        FileInfo info = new FileInfo();
        info.setOriginalName(originalName);
        info.setFileName(newName);
        info.setUrl("/file/" + datePath + "/" + newName);
        info.setSize(file.getSize());
        info.setContentType(file.getContentType());
        return info;
    }
    
    /**
     * ★ 文件校验
     */
    private void validateFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new BusinessException("文件不能为空");
        }
        if (file.getSize() > maxSize) {
            throw new BusinessException("文件大小超过限制");
        }
        
        // ★ 后缀白名单
        String ext = FilenameUtils.getExtension(file.getOriginalFilename());
        if (!Arrays.asList(allowedTypes).contains(ext.toLowerCase())) {
            throw new BusinessException("不允许的文件类型：" + ext);
        }
        
        // ★ 文件头校验（防止改后缀名）
        try (InputStream is = file.getInputStream()) {
            byte[] header = new byte[16];
            is.read(header);
            String realType = detectFileType(header);
            if (!isAllowedType(realType)) {
                throw new BusinessException("文件内容与后缀不匹配");
            }
        } catch (IOException e) {
            throw new BusinessException("文件校验失败");
        }
    }
    
    private String detectFileType(byte[] header) {
        if (header.length < 4) return "unknown";
        // PNG
        if (header[0] == (byte) 0x89 && header[1] == 0x50 && 
            header[2] == 0x4E && header[3] == 0x47) return "png";
        // JPEG
        if (header[0] == (byte) 0xFF && header[1] == (byte) 0xD8) return "jpg";
        // GIF
        if (header[0] == 0x47 && header[1] == 0x49 && header[2] == 0x46) return "gif";
        // PDF
        if (header[0] == 0x25 && header[1] == 0x50 && header[2] == 0x44 && header[3] == 0x46) return "pdf";
        return "unknown";
    }
}
```

## 3. 阿里 OSS 整合

```xml
<dependency>
    <groupId>com.aliyun.oss</groupId>
    <artifactId>aliyun-sdk-oss</artifactId>
    <version>3.17.4</version>
</dependency>
```

```java
@Configuration
public class OssConfig {
    
    @Value("${aliyun.oss.endpoint}")
    private String endpoint;
    
    @Value("${aliyun.oss.access-key-id}")
    private String accessKeyId;
    
    @Value("${aliyun.oss.access-key-secret}")
    private String accessKeySecret;
    
    @Value("${aliyun.oss.bucket-name}")
    private String bucketName;
    
    @Bean(destroyMethod = "shutdown")
    public OSS ossClient() {
        return new OSSClientBuilder()
            .build(endpoint, accessKeyId, accessKeySecret);
    }
    
    @Bean
    public OssProperties ossProperties() {
        OssProperties props = new OssProperties();
        props.setEndpoint(endpoint);
        props.setBucketName(bucketName);
        return props;
    }
}

@Service
public class OssFileService {
    
    @Autowired
    private OSS ossClient;
    
    @Autowired
    private OssProperties ossProps;
    
    /**
     * 普通上传
     */
    public String upload(MultipartFile file) throws IOException {
        String fileName = generateFileName(file.getOriginalFilename());
        
        ObjectMetadata metadata = new ObjectMetadata();
        metadata.setContentLength(file.getSize());
        metadata.setContentType(file.getContentType());
        metadata.setCacheControl("max-age=2592000");  // 30天缓存
        
        ossClient.putObject(ossProps.getBucketName(), fileName, 
            file.getInputStream(), metadata);
        
        return "https://" + ossProps.getBucketName() + "." + 
               ossProps.getEndpoint() + "/" + fileName;
    }
    
    /**
     * ★ 分片上传（大文件）
     */
    public String multipartUpload(MultipartFile file) throws IOException {
        String objectName = generateFileName(file.getOriginalFilename());
        
        // 1. 初始化分片上传
        InitiateMultipartUploadRequest initRequest = new InitiateMultipartUploadRequest(
            ossProps.getBucketName(), objectName);
        InitiateMultipartUploadResult initResult = ossClient.initiateMultipartUpload(initRequest);
        String uploadId = initResult.getUploadId();
        
        // 2. 分片上传
        long fileSize = file.getSize();
        long partSize = 5 * 1024 * 1024;  // 每片 5MB
        int partCount = (int) (fileSize / partSize);
        if (fileSize % partSize != 0) partCount++;
        
        List<PartETag> partETags = new ArrayList<>();
        try (InputStream is = file.getInputStream()) {
            for (int i = 0; i < partCount; i++) {
                long skipBytes = partSize * i;
                long remain = fileSize - skipBytes;
                long thisPartSize = Math.min(partSize, remain);
                
                byte[] buffer = new byte[(int) thisPartSize];
                is.skip(skipBytes - (i > 0 ? partSize * (i - 1) : 0));
                is.read(buffer);
                
                UploadPartRequest partRequest = new UploadPartRequest()
                    .withBucketName(ossProps.getBucketName())
                    .withKey(objectName)
                    .withUploadId(uploadId)
                    .withPartNumber(i + 1)
                    .withInputStream(new ByteArrayInputStream(buffer))
                    .withPartSize(thisPartSize);
                
                UploadPartResult partResult = ossClient.uploadPart(partRequest);
                partETags.add(partResult.getPartETag());
            }
        }
        
        // 3. 完成分片上传
        CompleteMultipartUploadRequest completeRequest = new CompleteMultipartUploadRequest(
            ossProps.getBucketName(), objectName, uploadId, partETags);
        ossClient.completeMultipartUpload(completeRequest);
        
        return generateUrl(objectName);
    }
    
    /**
     * ★ STS 临时凭证直传（减轻服务器压力）
     */
    public Map<String, String> generateStsToken() {
        // 创建 STS 客户端获取临时凭证
        // 前端直接用临时凭证上传 OSS，不经过应用服务器
        Map<String, String> result = new HashMap<>();
        result.put("accessKeyId", "STS.xxx");
        result.put("accessKeySecret", "xxx");
        result.put("securityToken", "xxx");
        result.put("bucket", ossProps.getBucketName());
        result.put("endpoint", ossProps.getEndpoint());
        result.put("expireTime", "3600");
        return result;
    }
}
```

## 4. MinIO 整合

```xml
<dependency>
    <groupId>io.minio</groupId>
    <artifactId>minio</artifactId>
    <version>8.5.7</version>
</dependency>
```

```java
@Configuration
public class MinioConfig {
    
    @Bean
    public MinioClient minioClient(
            @Value("${minio.endpoint}") String endpoint,
            @Value("${minio.access-key}") String accessKey,
            @Value("${minio.secret-key}") String secretKey,
            @Value("${minio.bucket-name}") String bucketName) {
        
        MinioClient client = MinioClient.builder()
            .endpoint(endpoint)
            .credentials(accessKey, secretKey)
            .build();
        
        // 自动创建 bucket
        try {
            if (!client.bucketExists(BucketExistsArgs.builder().bucket(bucketName).build())) {
                client.makeBucket(MakeBucketArgs.builder().bucket(bucketName).build());
                log.info("创建 MinIO bucket: {}", bucketName);
            }
        } catch (Exception e) {
            log.error("创建 bucket 失败", e);
        }
        
        return client;
    }
}

@Service
public class MinioFileService {
    
    @Autowired
    private MinioClient minioClient;
    
    @Value("${minio.bucket-name}")
    private String bucketName;
    
    /**
     * 上传
     */
    public String upload(MultipartFile file) throws Exception {
        String objectName = generateFileName(file.getOriginalFilename());
        
        minioClient.putObject(
            PutObjectArgs.builder()
                .bucket(bucketName)
                .object(objectName)
                .stream(file.getInputStream(), file.getSize(), -1)
                .contentType(file.getContentType())
                .build());
        
        return generateUrl(objectName);
    }
    
    /**
     * 下载
     */
    public InputStream download(String objectName) throws Exception {
        return minioClient.getObject(
            GetObjectArgs.builder()
                .bucket(bucketName)
                .object(objectName)
                .build());
    }
    
    /**
     * 生成预签名 URL（限时访问）
     */
    public String generatePresignedUrl(String objectName, int expireSeconds) throws Exception {
        return minioClient.getPresignedObjectUrl(
            GetPresignedObjectUrlArgs.builder()
                .bucket(bucketName)
                .object(objectName)
                .method(Method.GET)
                .expiry(expireSeconds)
                .build());
    }
}
```

## 5. 断点续传

```java
// 上传状态持久化
public interface UploadProgressService {
    UploadProgress getProgress(String uploadId);
    void saveProgress(UploadProgress progress);
    void clearProgress(String uploadId);
}

@Service
public class ResumableUploadService {
    
    @Autowired
    private RedisUtils redisUtils;
    
    /**
     * ★ 断点续传
     */
    public String resumableUpload(String uploadId, int partNumber, 
                                   MultipartFile part, String fileName) throws IOException {
        String progressKey = "upload:progress:" + uploadId;
        
        // 1. 查询已上传的分片
        UploadProgress progress = redisUtils.get(progressKey, UploadProgress.class);
        if (progress == null) {
            progress = new UploadProgress();
            progress.setUploadId(uploadId);
            progress.setFileName(fileName);
            progress.setUploadedParts(new ArrayList<>());
        }
        
        // 2. 检查是否已上传
        if (progress.getUploadedParts().contains(partNumber)) {
            return "已上传，跳过";  // ★ 幂等
        }
        
        // 3. 上传分片到 OSS
        uploadPart(uploadId, partNumber, part);
        
        // 4. 记录进度
        progress.getUploadedParts().add(partNumber);
        redisUtils.set(progressKey, progress, 24, TimeUnit.HOURS);
        
        // 5. 判断是否全部完成
        if (progress.getUploadedParts().size() == progress.getTotalParts()) {
            // 合并分片
            String url = completeMultipartUpload(uploadId);
            redisUtils.delete(progressKey);
            return url;
        }
        
        return null;  // 未完成
    }
}
```

## 6. 常见问题

```
┌─────────────────────────────────────────────┐
│ 文件存储常见问题                              │
├─────────────────────────────────────────────┤
│ 1. 安全                                      │
│    - ★ 后缀白名单                            │
│    - ★ 文件头校验（防改后缀）                │
│    - ★ 随机文件名（防路径穿越）              │
│    - ★ 图片二次渲染（防恶意图片）             │
│                                              │
│ 2. 大文件                                    │
│    - ★ 分片上传                              │
│    - ★ 断点续传                              │
│    - 流式读写（避免 OOM）                    │
│                                              │
│ 3. CDN 加速                                  │
│    - 静态资源走 CDN                          │
│    - OSS + CDN 是标准做法                    │
│                                              │
│ 4. 直传策略                                  │
│    - ★ STS 临时凭证直传（减轻服务器压力）     │
│    - 前端直接上传 OSS，服务器只记录 URL       │
└─────────────────────────────────────────────┘
```

## 关联笔记

- [[后端/JavaWeb/JWT认证与Web安全]]：文件上传安全
- [[后端/SpringBoot/整合Web开发]]：MultipartFile 参数绑定
- [[后端/Java工程化与部署/Docker与Nginx部署Java应用]]：Nginx 文件大小限制
