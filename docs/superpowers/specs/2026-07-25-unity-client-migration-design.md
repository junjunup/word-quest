# Word Quest Unity 客户端完整迁移设计

日期：2026-07-25  
状态：已授权执行  
目标编辑器：Unity 6000.5.3f1  
首发平台：Windows、macOS

## 1. 背景与决策

现有 Word Quest 是一个 Vue 3 + Phaser 3 客户端、Express + MongoDB 服务端、FastAPI LLM 服务组成的英语词汇学习游戏。当前客户端已经覆盖登录、角色选择、关卡探索、答题、Boss、无尽模式、错词复习、每日挑战、报告、排行榜、社交、成就和 AI 学伴等功能，但核心行为集中在 `GameView.vue` 与 `WorldScene.js` 两个超大文件中，UI 状态、游戏状态、接口调用和结算逻辑相互交织。

本次工作不是 Unity 版本升级，而是新建 Unity 客户端并保持服务端协议与 CET-4 功能不变。完成等价迁移后，再单独开展 K12 内容、课程标准和教学模型改造。用户已授权自主完成全部迁移和合理优化，不再逐项确认技术选择。

## 2. 目标与非目标

### 2.1 目标

- 使用 Unity 6000.5.3f1 创建 Windows/macOS 桌面客户端。
- 保留现有 Web 客户端作为迁移期行为基准。
- 复用现有 REST API、MongoDB 数据和 LLM 服务。
- 迁移现有全部客户端功能，不以删减功能换取完成速度。
- 使用清晰分层、状态机、接口隔离和可测试的纯 C# 领域逻辑消除现有耦合。
- 重新设计适合桌面端的像素风 UI，同时复用有授权的现有 Sprout Lands 素材。
- 提供项目级 Codex Skills、自动化检查、Unity 测试和构建说明。

### 2.2 非目标

- 第一阶段不把 CET-4 内容改成 K12。
- 第一阶段不重写 Express、MongoDB 或 FastAPI 服务。
- 不删除旧 `client/`，直到 Unity 功能等价验证完成。
- 不在第一阶段引入多人实时联机、付费系统或新的内容管理后台。
- 不为暂时不存在的远程内容更新需求引入 Addressables；资源访问通过接口隔离，后续需要时再替换。

## 3. 方案比较

### 3.1 方案 A：在原目录中大爆炸替换

直接删除 Vue/Phaser 客户端并在同一位置建立 Unity 项目。

优点：目录表面简单。  
缺点：失去行为基准，迁移期间无法对照功能，回归风险最高，也会破坏现有 Docker 和 CI 流程。  
结论：不采用。

### 3.2 方案 B：Unity 外壳内嵌旧 Web UI

Unity 负责地图和战斗，报告、社交、AI 面板等继续通过 WebView 显示。

优点：短期迁移快。  
缺点：需要第三方 WebView、跨平台输入和鉴权复杂、两套 UI 生命周期并存，无法真正消除客户端技术债。  
结论：不采用。

### 3.3 方案 C：并行的新 Unity 客户端

新增 `unity-client/`，通过同一 API 与服务端通信。旧客户端保持可运行，Unity 按里程碑实现功能等价，最终再切换默认入口。

优点：风险可控、可逐项比对、后端复用最大、架构可重新建立。  
缺点：迁移期间维护两个客户端，需要明确的功能矩阵。  
结论：采用。

## 4. 总体架构

Unity 客户端采用四层结构：

1. **Domain**：不依赖 Unity 的纯 C# 规则与模型，包括关卡会话、积分、连击、星级、掌握度展示、成就判定和答题状态。
2. **Application**：用例与状态机，包括登录、导航、开始关卡、提交答案、结算、复习、每日挑战、社交和 AI 会话。
3. **Infrastructure**：UnityWebRequest、JWT 存储、REST/SSE、JSON、持久化、音频与资源加载。
4. **Presentation/Gameplay**：UI Toolkit 屏幕控制器、2D 世界、玩家、怪物、Boss、交互和视觉反馈。

依赖方向固定为 Presentation/Infrastructure → Application → Domain。Domain 不引用 `UnityEngine`，以便快速执行 EditMode 测试和未来复用。

### 4.1 运行时组成

- `WordQuestApp`：唯一应用组合根，创建服务并启动状态机。
- `AppStateMachine`：`Boot → Authentication → Home → Game/Feature → Home`。
- `ScreenRouter`：控制 UI Toolkit 屏幕显示，替代 Vue Router。
- `ApiClient`：统一基地址、JWT、超时、错误映射与响应信封解析。
- `GameSession`：关卡内唯一权威状态，避免 Pinia、LevelManager 和 GameView 多份状态。
- `GameFlowController`：协调世界暂停、答题、Boss、结算和服务端提交。
- `ContentCatalog`：读取章节、关卡、角色和本地视觉配置。
- `FeatureFacade`：按认证、词汇、学习、游戏、社交、每日挑战、AI 分组暴露用例。

### 4.2 UI 技术

新界面使用 UI Toolkit 的 UXML + USS。Unity 官方建议新 UI 项目优先使用 UI Toolkit；其结构、样式和行为分离方式也便于从现有 Vue 经验迁移。游戏世界使用 SpriteRenderer、Collider2D 和 Rigidbody2D。HUD、弹窗、菜单和报告统一由 UI Toolkit 管理，不在世界场景内混用多套 UI 系统。

界面基准为 16:9、最小 1280×720，支持窗口缩放到 2560×1440。布局采用像素风视觉，但正文、表单和图表使用清晰的桌面排版。键盘鼠标为首发输入，所有游戏动作通过输入抽象层暴露，为手柄和后续移动端保留空间。

## 5. 功能迁移矩阵

### 5.1 账户与导航

- 登录、注册、JWT 恢复与过期处理
- 首页、主菜单、个人资料、退出登录
- 角色选择与 8 个角色索引
- 每日奖励

### 5.2 核心游戏

- 6 章 30 关配置
- 田园像素地图、玩家移动、碰撞、NPC、怪物
- 选择、拼写、翻译等题型
- 简单、普通、困难三档
- 生命、积分、连击、计时、星级和关卡解锁
- 错答怪物恢复、连续错误保护和教程模式
- 巡逻、炮台、冲锋三类 Boss
- 暂停、静音、Game Over 与结算
- 音乐、音效和视觉反馈

### 5.3 学习功能

- 自适应题型与服务端返回的难度建议
- 答题记录、掌握度、错因和复习队列
- 今日复习与复习会话
- 无尽模式
- 每日挑战与挑战榜
- 学习报告、每日统计、章节统计、错词排行和热力图
- 词书选择、词书统计和词汇导入入口
- 发音评分及历史入口

### 5.4 社交与激励

- 总分/经验排行榜
- 成就列表、解锁与弹出通知
- 用户搜索、好友请求、接受/拒绝和删除
- 异步 PK 创建、列表、详情与提交

### 5.5 AI 学伴

- 手动对话与答错触发
- 当前单词、答案质量、连错和章节上下文
- SSE 流式显示
- SSE 不可用时自动回退到非流式 `/chat/message`
- 取消生成、超时、内容安全提示和服务降级

## 6. 数据与协议

现有服务端 `{ success, data, message }` 响应信封保持不变。Unity 客户端为每个端点创建显式 DTO，不把服务端 JSON 直接传入 UI 或领域层。

首阶段沿用：

- `/api/auth/*`
- `/api/game/*`
- `/api/vocab/*`
- `/api/learning/*`
- `/api/daily-challenge/*`
- `/api/social/*`
- `/api/pronunciation/*`
- `/api/chat/message` 与 `/api/chat/stream`

JSON 反序列化优先使用 Unity 内置 `JsonUtility` 可表达的 DTO。对字典、异构数据和顶层数组，通过小型包装 DTO 或手写转换器处理，避免在没有明确收益时引入大型 JSON 依赖。

本地只保存服务端地址、音量、难度、词书、角色缓存和 JWT。JWT 通过 `ITokenStore` 隔离；第一版使用 PlayerPrefs 达到与 Web localStorage 相同的安全级别，不在日志中输出令牌。未来如进入正式面向未成年人发布阶段，应使用 Windows Credential Manager/macOS Keychain 实现替换该接口。

## 7. 错误处理与降级

- 401：清除令牌并回到登录页。
- GET 超时或临时网络错误：最多重试一次，带短暂退避。
- POST/PUT/DELETE：默认不自动重试，避免重复提交。
- 词汇加载失败：显示明确错误并允许重试，不启动空关卡。
- 结算提交失败：保存本地待同步记录，下一次进入首页时重试。
- AI SSE 失败：回退非流式接口；AI 整体不可用时不阻断其他游戏功能。
- 资源缺失：使用可识别的占位图并记录资源键，不使场景崩溃。
- 所有用户可见错误使用中文文案；详细异常仅进入开发日志。

## 8. 资源与视觉

现有像素素材复制到 `unity-client/Assets/WordQuest/Resources/Art`，音频复制到 `Resources/Audio`。编辑器导入规则统一设置 Point Filter、无压缩或适当压缩、关闭 mipmap，并检查大小与命名。

世界地图第一版由可重复的程序化布局生成，复现原有田园探索、NPC、怪物和 Boss 区域。关卡数据与视觉主题解耦：同一游戏机制可以切换章节主题，未来 K12 内容改造时不需要改世界控制代码。

资源提供者使用 `IAssetProvider`。第一版为 `ResourcesAssetProvider`；项目资源规模或远程更新需求增长后，可迁移到 Addressables，而不改变上层用例。

## 9. 项目级 Skills

仓库新增以下 Codex Skills：

- `unity-client-workflow`：规定 Unity 目录、程序集边界、编码风格、禁止提交的生成目录和验证顺序。
- `unity-api-contract`：从 Express 路由和 Unity DTO 双向检查端点、字段与认证要求。
- `unity-feature-parity`：使用功能矩阵检查旧客户端能力是否已迁移。
- `unity-validation`：执行静态检查、EditMode、PlayMode 和 Windows/macOS 构建前检查。

Skills 位于 `.agents/skills/`，仅服务本仓库；脚本位于各 Skill 的 `scripts/`，参考资料位于 `references/`。

## 10. 测试与验证

### 10.1 EditMode

- GameSession 计分、生命、连击和星级
- 难度配置与怪物数量
- 题目构建与答案判定
- 成就规则
- 状态机合法迁移
- API 响应信封、错误映射和 DTO fixture

### 10.2 PlayMode

- 启动到登录页
- 登录后进入首页
- 选择关卡并生成世界
- 遇怪后暂停世界、答题并恢复
- Boss 完成后结算
- 屏幕路由切换不泄漏事件监听

### 10.3 静态和构建验证

- 资源、UXML、USS、程序集和场景引用检查
- 禁止 `Library/`、`Temp/`、`Logs/`、`Obj/` 入库
- API 端点覆盖矩阵
- Windows x86_64 和 macOS Universal 构建配置
- Unity 批处理测试命令和 CI 示例

当前机器未安装 Unity Editor，因此实现期间可以完成源码、资源、项目配置和非编辑器静态验证，但不能声称 Unity 编译、EditMode/PlayMode 或 Player 构建通过。最终报告必须把“已验证”和“需在 Unity 6000.5.3f1 中执行”分开列出。

## 11. 实施里程碑

1. **项目与契约基线**：Unity 项目、程序集、Skills、资源导入规则、功能矩阵。
2. **平台基础**：应用启动、状态机、UI Shell、输入、存储、REST/SSE。
3. **核心纵向切片**：登录、选关、探索、遇怪、答题、结算、AI。
4. **玩法等价**：Boss、无尽、教程、难度、音频、角色、成就。
5. **学习等价**：复习、每日挑战、掌握度、报告、发音和词书。
6. **社交等价**：排行榜、好友、异步 PK、个人资料。
7. **质量收口**：全部测试、性能与资源检查、Windows/macOS 构建准备、迁移文档。

每个里程碑都以可运行状态结束；旧客户端不在任一中间里程碑被删除。

## 12. 验收标准

- `unity-client/` 可被 Unity 6000.5.3f1 识别。
- 功能矩阵中的每个现有客户端能力都有对应 Unity 屏幕、控制器或明确测试。
- Unity 客户端不直接依赖 Vue、Phaser、浏览器 localStorage 或浏览器路由。
- 服务端现有测试保持不变，Unity 不要求破坏性 API 修改。
- 核心领域逻辑不引用 UnityEngine。
- 网络、AI 和结算失败均有用户可恢复路径。
- Windows/macOS 构建配置、批处理验证命令和部署说明齐全。
- K12 改造所需的内容、课程与视觉主题已经与核心玩法解耦。

## 13. 官方技术依据

- Unity 6000.5.3f1 发布说明：https://unity.com/releases/editor/whats-new/6000.5.3f1
- Unity 6 UI Toolkit：https://docs.unity3d.com/6000.0/Documentation/Manual/ui-systems/introduction-ui-toolkit.html
- Unity Input System：https://docs.unity3d.com/6000.0/Documentation/Manual/com.unity.inputsystem.html
- Codex Skills：https://learn.chatgpt.com/docs/customization/overview#skills
