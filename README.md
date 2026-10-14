# 幽宫图志 TombAtlas

古墓主题在线 3D 博物馆 / 图志。维基百科式的知识库 + 程序化生成的 3D 墓室漫游。

## 核心原则

- **不采集、不扫描**：3D 场景由代码程序化生成
- **内容自维护**：MDX / JSON 数据文件，构建期 Zod 强校验
- **SEO 友好**：独立静态 URL、Open Graph、JSON-LD、sitemap
- **无后端**：纯静态部署，无登录、无数据库
- **渐进增强**：3D 是增强体验，文字内容始终完整可读

## 技术栈

| 层级 | 选择 |
|---|---|
| 框架 | Astro + Content Collections (Zod) |
| 3D | Three.js 原生岛屿（IntersectionObserver 懒加载） |
| 搜索 | Pagefind（M3） |
| SEO | 自建 BaseHead + JSON-LD + @astrojs/sitemap |
| 部署 | Cloudflare Pages |
| 构建 | rdev → server（mise 管理 node） |

## 内容结构

```
src/content/
├── tombs/<slug>.mdx       # 墓室：朝代/地域/墓主/解说
├── artifacts/<slug>.mdx   # 文物：年代/材质/解说，tomb 字段关联墓室
└── scenes/<slug>.json     # 3D 布局：chambers/corridors/artifacts（与 tomb slug 同名）
```

新增一座墓 = 添加 3 个文件（tomb + scene + 若干 artifact），构建期自动校验。

## 性能预算

- 首屏 HTML < 50KB；3D chunk `client:visible` 按需加载
- 3D 场景 draw calls < 50，三角形 < 100k，纹理 ≤ 1024px
- Lighthouse ≥ 95

## 开发

```bash
pnpm install
pnpm dev        # 本地开发
pnpm build      # 构建（本地仅编辑，构建优先用 rdev）
rdev sh <<'EOF' # 远端构建
corepack enable
pnpm install
pnpm build
EOF
```

## 路线

- **M1 地基**：脚手架 + 内容集合 + 满城汉墓（真实示例）+ SEO + SVG 平面图 ✅
- **M2 3D**：程序化场景生成器 + 热点 + 导览/漫游/俯瞰三模式 + 移动端画质分档 ✅
- **M3 体验**：Pagefind 搜索、筛选页、`/en/` i18n、性能打磨
