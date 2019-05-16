
# code-style-cli

基于git hooks和[fecs](https://github.com/ecomfe/fecs)实现的代码风格检查工具

## 使用

### 全局安装

```sh
npm install -g code-style-cli
```

### 本地安装

```sh
npm install code-style-cli
```

### 初始化

```sh
cs -i
```

初始化时会：

- 在当前项目路径下生成文件：`.ignoreitr.js`
- 向`.git/hooks`注入`pre-commit`的钩子


### 运行代码风格检查
#### 命令执行
```sh
# 检查指定文件（未指定将检查所有git diff出的文件）
# options: -c ：指定git diff --cached; -h: help msg
cs [options] [file.js..]  
```

#### git commit时执行
`git commit`时将自动执行，检查所有提交的文件

### 配置
`.ignoreitr.js`文件支持用户自定义配置：
- stopCommit：检查不通过时是否阻止commit；默认为true
- ignore：配置检查时忽略的文件规则