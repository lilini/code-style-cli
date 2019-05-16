#!/usr/bin/env node

/**
 * @file cli
 * @author lijing77
 */

'use strict';

const chalk = require('chalk');
const csCheck = require('../index');
const baseOptionator = require('optionator');

// set cli option
const optionator = baseOptionator({
    prepend: 'cs [options] [file.js..] [dir]',
    defaults: {
        concatRepeatedArrays: true,
        mergeRepeatedObjects: true
    },
    options: [
        {
            heading: 'Basic configuration'
        },
        {
            option: 'cached',
            alias: 'c',
            type: 'Boolean',
            description: 'check git diff code style with --cached option'
        },
        {
            option: 'init',
            alias: 'i',
            type: 'Boolean',
            description: 'Init project'
        },
        {
            option: 'help',
            alias: 'h',
            type: 'Boolean',
            description: 'Show help'
        }
    ]
});


const cli = {
    /**
     * execute
     * @param {String} args The arguments to process.
     */
    execute(args) {
        // catch process error
        process.on('uncaughtException', err => {
            console.log('code-style-cli运行出错了！');
            console.log(err.stack);

            process.exitCode = 1;
        });

        let options;

        try {
            options = optionator.parse(args);
        } catch (error) {
            console.log(error);

            process.exitCode = 1;
            return;
        }

        options.files = options._ || [];

        // set to current dir
        if (!options.files.length) {
            options.files = ['.'];
        }

        if (options.help) {
            console.log(optionator.generateHelp());
            
            process.exitCode = 0;
            return;
        }

        if (options.init) {
            csCheck.init(options);

            process.exitCode = 0;
            return;
        }

        csCheck.check(options);
    }
};


// run cli
cli.execute(process.argv);
