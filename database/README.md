# 数据库说明

`migrations/001_init.sql` 是主结构文件，包含表、约束、索引和关系校验触发器。

`queries/` 中按实验验收点拆分了核心 SQL：

- `ancestors.sql`：查询某成员所有祖先
- `descendants.sql`：查询某成员所有后代
- `relationship_path.sql`：查询两人之间的亲缘路径
- `analytics.sql`：平均寿命最长的一代、复杂条件查询
- `performance_explain.sql`：索引优化前后的执行计划分析入口

`load_csv.sql` 使用 PostgreSQL `COPY`/`\copy` 从 `database/seed` 导入模拟数据。
