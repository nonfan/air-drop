# Airdrop 项目重构路线图

## 📅 时间线总览

```
Week 1-2  │ Phase 1: 基础重构
Week 3-4  │ Phase 2: 功能增强  
Week 5    │ Phase 3: 安全和性能
Week 6    │ Phase 4: 测试和发布
```

---

## 🎯 Phase 1: 基础重构（Week 1-2）

### Week 1: 核心服务重构

#### Day 1-2: 项目准备
- [x] 创建架构设计文档
- [ ] 创建新的分支 `refactor/architecture-v2`
- [ ] 设置新的目录结构
- [ ] 安装新依赖（Zustand, idb）

**交付物**：
- 新的项目结构
- 依赖更新完成

---

#### Day 3-4: UnifiedTransportService
- [ ] 实现 `UnifiedTransportService` 基础类
- [ ] 实现 Socket.IO 连接管理
- [ ] 实现 HTTP 客户端
- [ ] 添加连接状态管理
- [ ] 添加自动重连机制

**交付物**：
- `src/core/services/transport/UnifiedTransport.ts`
- `src/core/services/transport/SocketManager.ts`
- `src/core/services/transport/HttpClient.ts`

**测试**：
- 连接/断开测试
- 重连测试
- 错误处理测试

---

#### Day 5: TransferManager 基础
- [ ] 实现 `TransferManager` 基础类
- [ ] 实现传输任务创建
- [ ] 实现任务状态管理
- [ ] 实现基础的开始/暂停/取消功能

**交付物**：
- `src/core/services/transfer/TransferManager.ts`
- `src/core/types/transfer.ts`

**测试**：
- 任务创建测试
- 状态转换测试

---

### Week 2: 状态管理和服务整合

#### Day 1-2: Zustand 状态管理
- [ ] 设计状态结构
- [ ] 实现 `useAppStore`
- [ ] 实现设备管理 slice
- [ ] 实现传输管理 slice
- [ ] 实现设置管理 slice
- [ ] 添加持久化中间件

**交付物**：
- `src/core/store/index.ts`
- `src/core/store/slices/deviceSlice.ts`
- `src/core/store/slices/transferSlice.ts`
- `src/core/store/slices/settingsSlice.ts`

**测试**：
- 状态更新测试
- 持久化测试

---

#### Day 3-4: 设备发现服务重构
- [ ] 实现 `DiscoveryService` 统一接口
- [ ] 重构 `MDNSDiscovery`
- [ ] 重构 `UDPDiscovery`
- [ ] 实现自动降级机制
- [ ] 集成到 Zustand

**交付物**：
- `src/core/services/discovery/DiscoveryService.ts`
- `src/core/services/discovery/MDNSDiscovery.ts`
- `src/core/services/discovery/UDPDiscovery.ts`

**测试**：
- 设备发现测试
- 降级机制测试

---

#### Day 5: 桌面端集成
- [ ] 更新 `main.ts` 使用新服务
- [ ] 更新 IPC 处理器
- [ ] 更新渲染进程使用 Zustand
- [ ] 移除旧的服务代码

**交付物**：
- 更新的 `src/desktop/main/index.ts`
- 更新的 `src/desktop/renderer/App.tsx`

**测试**：
- 端到端测试
- 回归测试

---

## 🚀 Phase 2: 功能增强（Week 3-4）

### Week 3: 分片和断点续传

#### Day 1-2: 分片传输
- [ ] 实现 `ChunkManager`
- [ ] 实现文件分片逻辑
- [ ] 实现分片上传
- [ ] 实现分片下载
- [ ] 实现进度追踪

**交付物**：
- `src/core/services/transfer/ChunkManager.ts`
- `src/core/services/transfer/ProgressTracker.ts`

**测试**：
- 小文件测试（< 1MB）
- 大文件测试（> 100MB）
- 超大文件测试（> 1GB）

---

#### Day 3-4: 断点续传
- [ ] 实现 `ResumeManager`
- [ ] 实现 IndexedDB 存储
- [ ] 实现传输状态保存
- [ ] 实现传输恢复逻辑
- [ ] 实现失败重试

**交付物**：
- `src/core/services/transfer/ResumeManager.ts`
- `src/core/utils/storage.ts`

**测试**：
- 中断恢复测试
- 状态持久化测试

---

#### Day 5: 并发控制
- [ ] 实现 `ConcurrencyController`
- [ ] 实现传输队列
- [ ] 实现优先级管理
- [ ] 集成到 TransferManager

**交付物**：
- `src/core/utils/ConcurrencyController.ts`
- `src/core/services/transfer/TransferQueue.ts`

**测试**：
- 并发限制测试
- 队列管理测试

---

### Week 4: UI 优化和移动端集成

#### Day 1-2: 桌面端 UI 更新
- [ ] 更新传输页面使用新的进度显示
- [ ] 添加暂停/恢复按钮
- [ ] 添加队列管理 UI
- [ ] 优化进度条动画

**交付物**：
- 更新的 `FileDropZone.tsx`
- 新的 `TransferQueue.tsx` 组件

---

#### Day 3-4: 移动端集成
- [ ] 移动端使用 Zustand
- [ ] 移动端使用新的传输服务
- [ ] 优化移动端进度显示
- [ ] 添加断点续传支持

**交付物**：
- 更新的 `src/mobile/App.tsx`
- 更新的移动端组件

---

#### Day 5: 测试和优化
- [ ] 端到端测试
- [ ] 性能测试
- [ ] 内存泄漏检查
- [ ] Bug 修复

---

## 🔒 Phase 3: 安全和性能（Week 5）

### Day 1-2: 身份验证
- [ ] 实现 `AuthService`
- [ ] 实现配对码生成
- [ ] 实现设备配对流程
- [ ] 实现 Token 管理
- [ ] 添加配对 UI

**交付物**：
- `src/core/services/auth/AuthService.ts`
- 配对界面组件

**测试**：
- 配对流程测试
- Token 验证测试

---

### Day 3: 加密传输
- [ ] 实现 `CryptoUtils`
- [ ] 实现密钥生成
- [ ] 实现文件加密
- [ ] 实现文件解密
- [ ] 集成到传输流程

**交付物**：
- `src/core/utils/crypto.ts`

**测试**：
- 加密/解密测试
- 性能测试

---

### Day 4: 错误处理
- [ ] 实现 `ErrorHandler`
- [ ] 实现统一错误类型
- [ ] 实现错误恢复机制
- [ ] 添加用户友好的错误提示

**交付物**：
- `src/core/utils/ErrorHandler.ts`
- `src/core/types/errors.ts`

---

### Day 5: 性能优化
- [ ] 代码分割
- [ ] 懒加载优化
- [ ] 内存优化
- [ ] 网络优化
- [ ] 性能测试

---

## ✅ Phase 4: 测试和发布（Week 6）

### Day 1-2: 测试
- [ ] 单元测试（目标 80% 覆盖率）
- [ ] 集成测试
- [ ] E2E 测试
- [ ] 性能测试
- [ ] 安全测试

**测试清单**：
- [ ] 所有核心服务单元测试
- [ ] 传输流程集成测试
- [ ] 设备发现测试
- [ ] 断点续传测试
- [ ] 并发传输测试
- [ ] 错误处理测试

---

### Day 3: 文档更新
- [ ] 更新 README
- [ ] 更新 API 文档
- [ ] 创建迁移指南
- [ ] 创建用户手册
- [ ] 更新 CHANGELOG

**文档清单**：
- [ ] `README.md`
- [ ] `API_DOCUMENTATION.md`
- [ ] `MIGRATION_GUIDE.md`
- [ ] `USER_MANUAL.md`
- [ ] `CHANGELOG.md`

---

### Day 4: Beta 发布
- [ ] 创建 Beta 版本
- [ ] 内部测试
- [ ] 收集反馈
- [ ] Bug 修复

**发布清单**：
- [ ] 版本号：v2.0.0-beta.1
- [ ] 发布说明
- [ ] 已知问题列表

---

### Day 5: 正式发布
- [ ] 最终测试
- [ ] 创建发布版本
- [ ] 发布到 GitHub
- [ ] 更新官网
- [ ] 发布公告

**发布清单**：
- [ ] 版本号：v2.0.0
- [ ] 发布说明
- [ ] 下载链接
- [ ] 升级指南

---

## 📊 里程碑

### Milestone 1: 基础架构完成（Week 2 结束）
- ✅ 新的服务架构
- ✅ Zustand 状态管理
- ✅ 设备发现重构
- ✅ 桌面端集成

**验收标准**：
- 基础传输功能正常
- 设备发现正常
- 无明显性能问题

---

### Milestone 2: 功能增强完成（Week 4 结束）
- ✅ 分片传输
- ✅ 断点续传
- ✅ 并发控制
- ✅ 移动端集成

**验收标准**：
- 大文件传输正常
- 断点续传正常
- 并发传输正常
- 移动端功能完整

---

### Milestone 3: 安全和性能完成（Week 5 结束）
- ✅ 身份验证
- ✅ 加密传输
- ✅ 错误处理
- ✅ 性能优化

**验收标准**：
- 配对流程正常
- 加密传输正常
- 错误处理完善
- 性能达标

---

### Milestone 4: 正式发布（Week 6 结束）
- ✅ 测试完成
- ✅ 文档完成
- ✅ Beta 测试
- ✅ 正式发布

**验收标准**：
- 测试覆盖率 > 80%
- 所有文档完成
- Beta 测试通过
- 正式版本发布

---

## 🎯 成功指标

### 技术指标
| 指标 | 当前值 | 目标值 | 测量方法 |
|------|--------|--------|----------|
| 代码覆盖率 | 0% | 80% | Jest |
| 传输成功率 | 95% | 99% | 日志分析 |
| 平均传输速度 | 基准 | +30% | 性能测试 |
| 内存占用 | 基准 | -30% | 性能监控 |
| 启动时间 | 基准 | -50% | 性能测试 |

### 业务指标
| 指标 | 当前值 | 目标值 | 测量方法 |
|------|--------|--------|----------|
| 用户满意度 | 4.0 | 4.5 | 用户调查 |
| 崩溃率 | 0.5% | 0.1% | 错误监控 |
| 日活用户 | 基准 | +20% | 分析工具 |
| 支持工单 | 基准 | -40% | 工单系统 |

---

## 🚨 风险管理

### 高风险项
1. **兼容性问题**
   - 风险：新版本与旧版本不兼容
   - 缓解：提供迁移工具，保留旧版本支持
   - 应急：回滚到旧版本

2. **性能回退**
   - 风险：重构导致性能下降
   - 缓解：充分的性能测试
   - 应急：性能优化专项

3. **开发延期**
   - 风险：6 周时间不够
   - 缓解：分阶段实施，优先核心功能
   - 应急：延长 1-2 周

---

## 📝 每日站会议程

### 站会时间
- 每天上午 10:00
- 时长：15 分钟

### 议程
1. 昨天完成了什么？
2. 今天计划做什么？
3. 遇到什么阻碍？

### 周会（每周五）
- 回顾本周进展
- 演示完成的功能
- 计划下周工作
- 风险评估

---

## 🎉 发布计划

### Beta 版本（Week 6 Day 4）
- **版本号**：v2.0.0-beta.1
- **发布渠道**：GitHub Releases
- **测试用户**：内部团队 + 10 名外部测试者
- **测试周期**：3-5 天

### 正式版本（Week 6 Day 5）
- **版本号**：v2.0.0
- **发布渠道**：
  - GitHub Releases
  - 官网下载
  - 应用商店（如适用）
- **发布公告**：
  - 官网博客
  - 社交媒体
  - 邮件通知

---

## 📞 联系方式

### 项目负责人
- **产品经理**：[姓名]
- **技术负责人**：[姓名]
- **测试负责人**：[姓名]

### 沟通渠道
- **日常沟通**：Slack/Teams
- **问题跟踪**：GitHub Issues
- **文档协作**：Notion/Confluence

---

**文档版本**: 1.0  
**创建日期**: 2026-02-03  
**最后更新**: 2026-02-03  
**下次审核**: 每周五
