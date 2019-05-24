
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

```sh
    {
	    // 检查不通过时是否阻止commit；默认为true
	    "stopCommit": true,
	    // 配置要检查的rule，open指定是否开启这个checker，warnIgnored指定是否忽略当前checker的warn提示，默认htmlcs的warn提示是忽略的
	    "checkRules":{
	        "htmlcs": {
	            "open": true,
	            "warnIgnored": true
	        },
	        "csshint": {
	            "open": true,
	            "warnIgnored": false
	        },
	        "eslint": {
	            "open": true,
	            "warnIgnored": false
	        }
	    },
	    // 配置检查时忽略的文件规则
	    "ignore": [
	        "*.json",
	        "fis.config.js"
	    ]
    }
```

### 注释方式豁免检查
1、htmlcs豁免注释：

```sh
    <!-- htmlcs-disable rule1[,rule2,...] -->
	    你要豁免的代码
	<!-- htmlcs-enable rule1[,rule2,...] -->
```

2、csshint豁免注释：

```sh
    /* csshint-disable rule1[,rule2,...] */
	    你要豁免的代码
	/* csshint-enable rule1[,rule2,...] */
```

3、eslint豁免注释：

```sh
    /* eslint-disable rule1[,rule2,...] */
	    你要豁免的代码
	/* eslint-enable rule1[,rule2,...] */
```
