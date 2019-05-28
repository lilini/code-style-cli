/**
 * @file code-style-cli main file
 * @author lijing77
 */

const fs = require('fs');
const util = require('util');
const path = require('path');
const fecs = require('fecs');
const chalk = require('chalk');
const fsExtra = require('fs-extra');
const Minimatch = require('minimatch').Minimatch;
const processExec = require('child_process').execSync;

const version = require('./package').version;
const DEFAULT_RC = require('./conf/ignoreitr.js');

// Diff stdout expr
const DIFF_REG = /(\n|^)diff --git a\/(\S+) b\/\2[^\n]*/gi;

// Modified region expr
const MODIFY_REG = /\n@@ -(\d+),\d+ \+(\d+),\d+ @@[^\n]*((\n[ +\-\\][^\n]*)*)/gi;

let ModifiedFiles = {};
let checkRulesConfig = {};

/**
 * get modified lines
 * @param {String} modify
 * @return {Array.<Number>}
 */
function getModifiedLines(modify) {
    let lines = new Set();
    let match = null;

    while (match = MODIFY_REG.exec(modify)) {
        let text = match[3];
        let newline = +match[2];

        text.replace(/^\n/, '').split(/\n/).forEach((line) => {
            if (line.match(/^\+/)) {
                lines.add(newline);
            }

            // line start with '\'
            if (line.match(/^[+ ]/)) {
                newline++;
            }
        });
    }

    return lines;
}


/**
 * find project path
 * @param {String} cwd
 * @return {String} 
 */
function findProjectRoot(cwd) {
    let list = cwd.split(path.sep);
    let root;

    for (let i = 0; i < list.length; i++) {
        let dir = list.slice(0, list.length - i).join(path.sep);
        if (fs.existsSync(path.join(dir, '.git'))) {
            root = dir;
            break;
        }
    }

    return root;
}

/**
 * console log modified lines with errors
 *
 * @param {vinyl.File} file
 * @param {Array.<Object>} json: errors array
 * @param {Function} filter array
 * @param {Object} options
 * @return {boolean} check result
 */
function transform(file, json, filter, options) {
    let item = {relative: file.relative};
    let modifiedLines = ModifiedFiles[file.path];

    let Severity = {
        WARN: 1,
        ERROR: 2
    };

    // filter error
    let errors = file.errors.filter(error => {
        let ruleConfig = checkRulesConfig[error.checker]

        // 以下几种情况舍弃error：
        // 未配置该checker检查
        // 当前error不在本次提交的修改行内
        // 当前error为warn且用户设置不开启warn提示
        if (!ruleConfig || !ruleConfig.open
            || (typeof error.line === 'number' && !modifiedLines.has(error.line))
            || (error.origin && (error.origin.severity === Severity.WARN || error.origin.type === 'WARN') && ruleConfig.warnIgnored)) {
            return false;
        }
        else {
            return true;
        }
    });

    // sort error msg by line and column
    if (options.sort) {
        errors = errors.sort(function (a, b) {
            return a.line - b.line || a.column - b.column;
        });
    }

    // print fileName
    if (errors.length) {
        console.log('\n' + chalk['red']('File: ') + file.path);
    }

    errors = item.errors = file.errors = filter(errors.map(function (error) {
        var info = '→ ';

        if (typeof error.line === 'number') {
            info += ('line ' + error.line);
            if (typeof error.column === 'number') {
                info += (', col ' + error.column);
            }
            info += ': ';
        }

        info = chalk['yellow'](info);

        var message = error.message.replace(/baidu\d{3}$/, '').replace(/[\r\n]+/g, '');
        info += message;

        var rule = error.rule || 'syntax';

        if (options.rule) {
            info += '\t(' + chalk['gray'](rule) + ')';
        }

        // print error msg
        console.log(info);

        return {
            line: error.line,
            column: error.column,
            severity: error.origin.severity || 1,
            message: message,
            rule: rule,
            info: info
        };
    }));

    var success = true;

    if (!errors.length) {
        return success;
    }

    json.push(item);

    return success;
}

/**
 * filter ignore file
 *
 * @param {Array} ignore ignore file array
 * @param {String} path file's path
 * @return {boolean} check result
 */
function ignoreFile(ignore, path) {
    let pattern = ignore || [];
    let is = false;

    if (typeof pattern === 'string') {
        pattern = [ pattern ];
    }

    const tests = pattern.map(p => {
        return {
            isNot: !!p.match(/^!/),
            mm: new Minimatch(p.replace(/^!/, ''))
        };
    });

    tests.forEach((test) => {
        if (test.isNot) {
            if (is && test.mm.match(path)) {
                is = false;
            }
        } else {
            if (!is && test.mm.match(path)) {
                is = true;
            }
        }
    });

    return is;
}

/**
 * Write rc file
 * @param {String} to
 * @param {...Object} args
 */
function writeRc(to, ...args) {
    const rc = Object.assign({}, ...args);

    fsExtra.writeFileSync(to, `module.exports = ${JSON.stringify(rc, null, 4)}`);
}

/**
 * Init ignoreitr
 * @param {Object} options
 * @return {String}
 */
function initIgnoreitr(options) {
    const rcPath = '.ignoreitr.js';

    let commit_version;

    if (fsExtra.existsSync(rcPath)) {
        commit_version = fsExtra.readFileSync(rcPath).toString().match(/"version": "([\d\.]+)"/) && RegExp.$1;
    }

    if (options.override || !fsExtra.existsSync(rcPath) || version !== commit_version) {
        writeRc(rcPath, require('./conf/ignoreitr.js'), options.ignoreitr);
        return rcPath;
    }
}

/**
 * Init precommit hook
 * @param {Object} options
 * @return {String}
 */
function initPreCommit(options) {
    const from = path.join(__dirname, './hooks/pre-commit');
    const to = '.git/hooks/pre-commit';

    let commit_version;

    if (fsExtra.existsSync(to)) {
        commit_version = fsExtra.readFileSync(to).toString().match(/# code-style-cli PreCommit v([\d\.]+)/) && RegExp.$1;
    }

    if (version !== commit_version) {
        fsExtra.copySync(from, to);
        return to;
    }
}

/**
 * check ignoreitr has checkRule
 * @return {boolean} has checkRule
 */
function hasCheckRule() {
    let flag = false;

    if (typeof checkRulesConfig !== 'object') {
        return flag;
    }

    Object.keys(checkRulesConfig).forEach(key => {
        if (checkRulesConfig[key] && checkRulesConfig[key]['open']) {
            flag = true;
        }
    });

    return flag;
}

/**
 * Index entry
 */
module.exports = {
    /**
     * init project
     * @param {Object} options
     * @param {?Boolean} options.override
     * @param {?Object} options.ignoreitr
     */
    init(options = {}) {
        console.log(chalk['yellow']('code-style-cli 初始化开始..\n'));

        [initIgnoreitr, initPreCommit,].forEach((fn) => {
            const file = fn(options);

            if (file) {
                console.log(chalk['yellow']('初始化文件: ') + file + '\n');
            }
        });

        console.log(chalk['yellow']('初始化完成\n'));
    },


    /**
     * check code style
     * @param {Object} options to process
     */
    check(options = {}) {
        console.log('开始代码规范检查..\n');

        const cwd = process.cwd();
        const root = findProjectRoot(cwd);

        if (!root) {
            throw new Error('该目录下未找到 .git');
        }

        // read current path ignoreitr
        const rcPath = path.join(root, '.ignoreitr.js');

        try {
            this.rc = require(rcPath);
        } catch(ex) {
            this.rc = DEFAULT_RC;
        }

        // 获取配置的检查rule
        checkRulesConfig = this.rc && this.rc.checkRules || {};

        if (!hasCheckRule()) {
            console.log("ignoreitr配置里没有要检查的规则！");
            process.exit(0);
        }
        else {
            this.options = Object.assign(
                Object.create(null),
                {
                    cached: false,
                    files: [],
                    rc: this.rc,
                    root: root,
                    type: 'js,css,html,less',
                    cwd: cwd
                },
                options
            );

            this.fecsCheck(this.getModifiedFiles());
        }
    },

    /**
     * Get modified files
     * @return {Object}
     */
    getModifiedFiles() {
        const {options} = this;
        const filesOption = (options.files || []).map(str => `"${str}"`);

        let cmd = `git diff --ignore-space-at-eol ${options.cached ? '--cached' : ''} ${filesOption.join(' ')}`;

        const diff = processExec(cmd).toString();

        let filePaths = [];

        let prevFilePath;
        let prevStartIndex;
        let match;

        function collect(end) {
            const modify = diff.substring(prevStartIndex, end);

            const lines = getModifiedLines(modify);

            if (lines.size && !ignoreFile(options.rc.ignore, prevFilePath)) {
                let fullpath = path.resolve(options.root, prevFilePath);
                ModifiedFiles[fullpath] = lines;
                filePaths.push(fullpath);
            }
        }

        while (match = DIFF_REG.exec(diff)) {
            if (prevFilePath) {
                collect(match.index);
            }

            prevFilePath = match[2];
            prevStartIndex = match.index;
        }

        if (prevFilePath) {
            collect(diff.length);
        }

        return filePaths
    },

    /**
     * check code use fecs
     * @param  {Array} files files array
     */
    fecsCheck(files) {
        if (!files.length) {
            console.log('没有需要检查的文件，检查通过\n');
            process.exit(0);
        }

        let self = this;
        let options = {
            rule: true,
            stream: false,
            lookup: true,
            type: self.options.type,
            reporter: transform,
            _: files
        };

        let done = function (success, json) {
            success = success && json.length === 0;

            if (!success && self.rc.stopCommit) {
                console.log('\n代码规范检查未通过，请修改后提交！');

                process.exit(1);
            }
            else {
                console.log('代码规范检查通过\n');

                process.exit(0);
            }
        };

        fecs.check(options, done);
    }
};

