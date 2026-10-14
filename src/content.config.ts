import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

const vec3 = z.tuple([z.number(), z.number(), z.number()]);

const tombs = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/tombs' }),
  schema: z.object({
    title: z.string(),
    dynasty: z.string(),
    region: z.string(),
    tombOwner: z.string().optional(),
    description: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const artifacts = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/artifacts' }),
  schema: z.object({
    name: z.string(),
    tomb: z.string(), // 关联 tombs 集合的 slug
    period: z.string(),
    material: z.string(),
    description: z.string(),
    tags: z.array(z.string()).default([]),
  }),
});

// 3D 场景布局：构建期 Zod 强校验，artifact 只存引用避免数据重复
const scenes = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/scenes' }),
  schema: z.object({
    chambers: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum(['rect', 'circular']).default('rect'),
        size: vec3, // [宽, 高, 深]，米
        position: vec3.default([0, 0, 0]), // 中心点 [x, y, z]
        texture: z.enum(['brick', 'stone', 'earth']).default('brick'),
        vault: z.enum(['flat', 'barrel', 'dome']).default('flat'),
        mural: z.boolean().default(false), // 内壁是否生成壁画带（示意装饰）
      }),
    ),
    corridors: z.array(
      z.object({
        from: z.string(), // chamber id 或 "entrance"
        to: z.string(),
        length: z.number(),
        width: z.number(),
        height: z.number().default(2.5),
        rise: z.number().default(0), // 斜坡墓道落差
        door: z.boolean().default(false), // 石门
      }),
    ),
    // 内部陈设：棺床、陶瓮阵列、漆案等程序化低模
    furnishings: z
      .array(
        z.object({
          type: z.enum([
            'coffin-bed',
            'pottery-row',
            'square-vats',
            'table',
            'wheel',
            'shelf',
            'chariot',
            'timber-house',
            'canopy',
            'bronze-set',
            'mill',
            'bath-set',
            'horse',
            'vessels',
            'figurines',
            'grave-goods',
          ]),
          chamber: z.string(),
          position: vec3,
          rotation: z.number().default(0), // 绕 y 轴弧度
          count: z.number().default(4),
        }),
      )
      .default([]),
    artifacts: z.array(
      z.object({
        id: z.string(), // 关联 artifacts 集合的 slug
        chamber: z.string(),
        position: vec3,
      }),
    ),
  }),
});

export const collections = { tombs, artifacts, scenes };
