import fs from 'fs';
import path from 'path';
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import colors from 'colors'
import util from 'util'
import request from 'request';
const validExtensions = [".js", ".html"]
import pug from 'pug';
const pugCompiledFunction = pug.compileFile('result.pug');
const token = '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';

yargs(hideBin(process.argv))
    .command('update [directory] [guidefile]', 'start the server', (yargs) => {
        return yargs
            .positional('directory', {
                describe: 'Project directory to search in',
                default: 'D:\\magnix-server\\front'
            })
            .positional('guidefile', {
                describe: 'the file contain modules to update',
                default: './guide.json'
            })
    }, (argv) => {
        checkInputs(argv, check);
    })
    .option('verbose', {
        alias: 'v',
        type: 'boolean',
        default: false,
        description: 'Run with verbose logging'
    })

    .option('cache', {
        alias: 'c',
        type: 'boolean',
        default: false,

        description: 'read from cache'
    })

    .option('cache-stage-1', {
        alias: 'c1',
        type: 'boolean',
        default: false,

        description: 'read from cache'
    })
    .demandCommand(1)
    .parse()

var options = {
    verbose: false,
    cache: false
};


//################################## Helpers
function convertVersion(version) {
    version = version.replace("^", "");
    version = version.replace("v", "");
    version = version.replace("V", "");

    if (version.indexOf("@") >= 0) {
        version = version.split("@")[1];
    }

    var parts = version.split(".")
    var total = 0;
    var weight = 100;
    for (var index in parts) {
        total += Number(parts[index]) * weight;
        weight /= 10;
    }
    return total;
}

function checkInputs(args, next) {
    if (!fs.existsSync(args.guidefile)) {
        console.error(colors.red(`argument Error: guidefile "${args.guidefile}" not found.`))
        return;
    }

    if (!fs.existsSync(args.directory)) {
        console.error(colors.red(`argument Error: directory "${args.directory}" not found.`))
        return;
    }
    var guideJson = undefined;
    try {
        guideJson = JSON.parse(fs.readFileSync(args.guidefile))
    }
    catch (e) {
        console.error(e);
        console.error(colors.red("Guide file Structure is not correct."))
        return
    }
    var packageJson = undefined;
    var packageLockJson = undefined;

    try {
        packageJson = JSON.parse(fs.readFileSync(path.join(args.directory, "package.json")))
        packageLockJson = JSON.parse(fs.readFileSync(path.join(args.directory, "package-lock.json")))
    }
    catch (e) {
        console.error(e);
        console.error(colors.red("Project Structure is not correct. Could not find package.json or package-lock.json"))
        return
    }


    options = args;

    console.log(colors.bgGreen.black("Reading Project Structure..."));
    console.log("Project Directory : " + colors.green(args.directory));
    console.log("Name : " + colors.green(packageJson.name));
    console.log("Version: " + colors.green(packageJson.version));
    console.log("Description: " + colors.green(packageJson.description));

    next({
        guideJson: guideJson,
        packageJson: packageJson,
        packageLockJson: packageLockJson,
        projectDirectory: args.directory
    });
}

function check({ guideJson, packageJson, packageLockJson, projectDirectory }) {
    console.log(colors.bgGreen.black("Stage one : Reading All Packages..."));

    var [packages, notfound] = [undefined, undefined];
    console.log(options)
    if (options.cache || options.c1) {
        packages = fs.readFileSync("result-packages.json");
        packages = JSON.parse(packages);

        notfound = fs.readFileSync("result-packages-notfound.json");
        notfound = JSON.parse(notfound);
    }
    else {
        [packages, notfound] = stageOne_ReadAllPackages({ guideJson, packageJson, packageLockJson });
        console.log(JSON.stringify(packages));
        console.log(util.inspect(packages, false, 100));

        fs.writeFileSync("result-packages.json", JSON.stringify(packages))
        fs.writeFileSync("result-packages-notfound.json", JSON.stringify(notfound))
    }

    printStage_One(packages, notfound);

    stageThree_FindAllModuleUsages(projectDirectory, (files) => {
        console.log(colors.bgGreen.black("Stage one : Completed."));
        console.log(colors.bgGreen.black("Stage Two : Get Available Versions..."));
        stageTwo_GetAllAvailableVersions(packages, (Result) => {

            console.log(colors.bgGreen.black("Stage Two : Completed."));
            console.log(colors.bgGreen.black("Stage Three : Normalizing the results..."));

            StageFour_NormalizeList(Result, (normalizedResult) => {
                console.log("normalized:", normalizedResult[0].dependOn[0])
                console.log("Result:", Result[0])
                console.log(colors.bgGreen.black("Stage Three : Completed."));

                makeResultJson(normalizedResult, files, (finalResult) => {
                    // console.log("finalResult:", finalResult)
                });

            });



            // console.log("Result:", JSON.stringify(Result));
            // 
        })
    });



}

//################################## Stage One


function stageOne_ReadAllPackages({ guideJson, packageJson, packageLockJson }) {

    var markedPackageModules = [];

    for (var index in guideJson) {
        var moduleFromGuide = guideJson[index];

        if (packageJson.dependencies[moduleFromGuide.module]) {
            for (var index2 in moduleFromGuide.from) {
                if (convertVersion(moduleFromGuide.from[index2]) >= convertVersion(packageJson.dependencies[moduleFromGuide.module])) {
                    var json = {
                        "module": moduleFromGuide.module,
                        "version": packageJson.dependencies[moduleFromGuide.module],
                        "rules": guideJson[index]
                    };

                    markedPackageModules.push(json);
                    break;
                }
            }
        }

        for (var ModuleName in packageLockJson.dependencies) {
            for (var ModuleRequiredName in packageLockJson.dependencies[ModuleName].requires) {

                if (guideJson[index].module == ModuleRequiredName) {

                    for (var index2 in guideJson[index].from) {
                        if (convertVersion(guideJson[index].from[index2]) >= convertVersion(packageLockJson.dependencies[ModuleName].requires[ModuleRequiredName])) {

                            // if (markedPackageModules[ModuleRequiredName] == undefined) {
                            //     markedPackageModules[ModuleRequiredName] = {
                            //         "module": guideJson[index].module,
                            //         "from": guideJson[index].from,
                            //         "to": guideJson[index].to
                            //     };
                            //     markedPackageModules[ModuleRequiredName]['modules'] = [];
                            // }

                            var json = {
                                "depend": {
                                    "module": ModuleRequiredName,
                                    "version": packageLockJson.dependencies[ModuleName].requires[ModuleRequiredName],

                                },
                                "rules": guideJson[index],
                                "module": ModuleName,
                                "version": packageLockJson.dependencies[ModuleName].version,

                            };
                            // json["obtainGit"] = moduleObtainGitFromNpm(ModuleName);
                            // json["obtainVersions"] = moduleObtainVersions();
                            // json["obtainPackage"] = moduleReadPackageFromGit();

                            markedPackageModules.push(json);
                            break;
                        }
                    }
                    break;
                }

            }
        }
    };


    var notfound = [];
    for (var index in guideJson) {
        var found = false;
        for (var i in markedPackageModules) {
            found = markedPackageModules[i].module == guideJson[index].module || (markedPackageModules[i].depend && markedPackageModules[i].depend.module == guideJson[index].module);
            if (found)
                break;
        }
        if (!found) {
            notfound.push(guideJson[index])
        }
    }

    //     if (markedPackageModules[guideJson[index].module] == undefined) {
    //         notfound.push(guideJson[index])
    //     }
    // }

    return [markedPackageModules, notfound];
}

function printStage_One(packages, notfound) {
    if (packages && Object.keys(packages).length > 0) {
        var table = {}
        var i = 1;
        for (var index in packages) {
            table[i] = JSON.parse(JSON.stringify(packages[index]));

            // table[i].modules = table[i].modules.length;
            i++;
        }
        console.log(`${Object.keys(packages).length} package(s) found`);
        console.table(table)
    }


    if (notfound && notfound.length > 0) {
        console.log(colors.bgYellow.black(`Warning: ${notfound.length} Package(s) not found:`));
        console.table(notfound)
    }
}



//################################## Stage Two

function moduleObtainGitFromNpm() {

    const runner =
    {
        run: (module, callback) => {
            request({ uri: "https://www.npmjs.com/package/" + module.module },
                function (error, response, body) {
                    var re = /<span>github.com\/\S*\/\S*<\/span>/g;
                    var s = body;
                    var m = re.exec(s);
                    if (m) {
                        var url = m[0].replace("<span>", "").replace("</span>", "");
                        var urls = url.split("/")
                        var result = {
                            url: "https://" + url,
                            tag: `https://api.github.com/repos/${urls[1]}/${urls[2]}/tags?per_page=100`,
                            'package': `https://${token}@raw.githubusercontent.com/${urls[1]}/${urls[2]}/[VERSION]/package.json`,
                            owner: urls[1],
                            repo: urls[2]
                        };
                        module.urls = result;
                        callback(true, module)

                        return;
                    }
                    callback(false);

                });
        }
    }
    return runner;

}


function moduleObtainVersions() {
    const runner =
    {
        run: (json, callback) => {
            runner.inner(json.urls.tag, json, callback)
        },
        inner: (url, json, callback) => {
            if (!json.tags) {
                json.tags = [];
            }

            request({
                uri: url,
                headers: {
                    'Authorization': 'token ' + token,
                    'user-agent': 'node.js'
                }
            },
                function (error, response, body) {
                    if (error) {
                        console.log("error", json.urls.tags, error)
                        callback(false);
                        return;
                    }
                    if (response.statusCode != 200) {
                        console.log("Not2 200:", json.urls.tags, json.urls.tags, body);
                        console.log("Not2 200:", response.headers);
                        callback(false);
                        return;
                    }
                    json.tags = json.tags.concat(JSON.parse(body))
                    if (response.headers) {
                        const nextReg = /\<(.+)\>\;\ ?rel="next"/g;

                        var m = nextReg.exec(response.headers["link"]);
                        if (m) {
                            var url = m[1]
                            runner.inner(url, json, callback)
                            // callback(true, json)
                            return;
                        }
                        callback(true, json)
                    }

                });

        }
    }
    return runner;
}

function moduleFilterTags() {

    const runner =
    {
        run: (json, callback) => {

            //### IF No Version found
            if (!json.tags) {
                console.log("error 1")
                callback({});
                return;
            }

            //For Modules which are depend on update Module
            const checkPackageDependencies = (currentTag, json) => {
                return new Promise((resolve, reject) => {
                    moduleReadPackageFromGit().run(json, currentTag.name, (result, packagePackage) => {
                        if (result) {
                            var version = "none";
                            if (packagePackage['dependencies'] && packagePackage['dependencies'][json.depend.module]) {
                                version = packagePackage['dependencies'][json.depend.module].replace("^", "");
                            }
                            resolve({
                                version: currentTag.name,
                                depend: version
                            });
                        }
                        else {
                            console.log("package read error:", currentTag.name)
                            resolve(false)
                        }

                    });
                });
            };

            //for normal modules
            const checkPackage = (currentTag, json) => {
                return new Promise((resolve, reject) => {
                    var version = currentTag.name.replace("^", "")
                    resolve({
                        version: version
                    })
                });
            };


            //choose filter function
            var filter = checkPackage;
            if (json.depend) {
                filter = checkPackageDependencies;
            }


            //Check all candidate versions
            var filterPromise = [];
            for (var i = Object.keys(json.tags).length - 1; i >= 0; i--) {
                const currentTag = json.tags[i];
                if (!currentTag) {
                    continue;
                }
                if (convertVersion(currentTag.name) > convertVersion(json.version)) {
                    filterPromise.push(filter(currentTag, json));
                }
            }


            //Add together and check version match
            Promise.all(filterPromise).then(function (results) {
                var tags = [];
                for (var index in results) {
                    if (results[index]) {
                        var version = results[index].version;
                        if (results[index].depend) {
                            version = results[index].depend;
                        }

                        if (json.rules.to.includes(version) || version == "none") {
                            tags.push({
                                version: results[index].version,
                                depend: results[index].depend,
                                match: 'exact'
                            });
                        }
                        else {
                            for (var ii in json.rules.to) {
                                if (version == "none" || convertVersion(version) > convertVersion(json.rules.to[ii])) {
                                    tags.push({
                                        version: results[index].version,
                                        depend: results[index].depend,
                                        match: 'bigger'
                                    });
                                }
                            }
                        }

                    }
                }
                json.tags = undefined;
                json.versions = tags;
                callback(json);

            });

        }
    }
    return runner;

}

function moduleReadPackageFromGit() {
    const runner =
    {
        run: (json, version, callback) => {
            //https://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@raw.githubusercontent.com/testing-library/jest-dom/v5.12.0/package.json
            var url = json.urls.package.replace("[VERSION]", version).replace("https://raw.githubusercontent.com", "https://" + token + "@raw.githubusercontent.com")
            //https://api.github.com

            // httpntlm.get({
            //     url: url,
            //     username: username,
            //     password: password,
            //     workstation: 'choose.something',
            //     domain: ''
            // }, function (error, response) {

            // });

            request({
                uri: url,
                headers: {
                    'Authorization': 'token ' + token,
                    'user-agent': 'node.js',
                    'Accept': 'application/vnd.github.v3.raw'
                }
            },
                function (error, response, body) {
                    if (error) {
                        console.log("error:", error);
                        callback(false);
                        return;
                    }
                    if (response.statusCode != 200) {
                        console.log("Not 200:", url, version);
                        console.log("Not 200:", version.headers);
                        console.log("Not 200:", body);

                        callback(false);
                        return;
                    }
                    callback(true, JSON.parse(body))
                });
        }
    }
    return runner;
}

function stageTwo_GetAllAvailableVersions(packages, callback) {
    if (options.cache) {
        var json = fs.readFileSync("result-versions.json");
        json = JSON.parse(json);
        callback(json);
        return;
    }

    var packagesPromise = [];
    for (var iPackage in packages) {
        const objModule = packages[iPackage];
        //###### PACKAGE
        packagesPromise.push(new Promise((resolve, reject) => {

            moduleObtainGitFromNpm().run(objModule, (result, jsonNpm) => {
                if (result) {
                    moduleObtainVersions().run(jsonNpm, (result, json) => {
                        if (result) {
                            moduleFilterTags().run(json, (cc) => {
                                //###### AVAILABLE VERSIONS
                                resolve(cc)
                            })
                        }
                        else {
                            reject()
                        }

                    });
                }
                else {
                    reject()
                }
            });



            // Promise.all(packagePromise).then((results) => {
            //     objModule.versions = results;
            //     console.log(colors.bgBlue.black(`Package : "${objModule.module}"" Found: `) + colors.bgBlue.black(results.length + " "));
            //     resolve(objModule);
            // })
        }));
    }

    Promise.all(packagesPromise).then((results) => {
        fs.writeFileSync("result-versions.json", JSON.stringify(results))
        callback(results);
    })
}


//################################## Stage Three
function stageThree_FindAllModuleUsages(projectDirectory, callback) {
    // console.log(util.inspect(getFiles(projectDirectory), false, 10));
    if (options.cache) {
        var json = fs.readFileSync("result-files.json");
        json = JSON.parse(json);
        callback(json)
    }
    else {
        var json = getFiles(projectDirectory)
        fs.writeFileSync("result-files.json", JSON.stringify(json))
        callback(json)
    }
}

function getFiles(address) {
    if (path.basename(address) === "node_modules") {
        return {
            notIncluded: true
        };
    }
    var files;

    try {
        files = fs.readdirSync(address, {})
    }
    catch
    {
        return {
            error: true,
            errorReadDirectory: tree
        };
    }
    var tree = []

    for (var index in files) {
        const file = files[index];
        const filePath = path.join(address, file)
        try {
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {

                if (validExtensions.includes(path.extname(filePath))) {
                    tree.push({
                        isFile: true,
                        path: filePath
                    });
                }
            }
            else {
                var x = getFiles(filePath);
                if (x && x.length > 0)
                    tree = tree.concat(x);
            }
        }
        catch (e) {
            // tree[address][file] = {
            //     error: true,
            // }
            console.log(e);
        }
    }
    return tree
}

function parseJsFile(filePath, module) {
    const reg1 = /import\ +(.+)\ +from\ +["|'](.*)["|']/g
    const reg2 = /[var|const]?\ +(.+)\ ?=\ ?require\([\' | "](.*)['|"]\)/g

    function isFromFile(module) {
        if (!module) {
            return false
        }
        return module.indexOf("./") >= 0 || module.indexOf("../") >= 0 || module.indexOf("/") == 0;
    }

    var data = fs.readFileSync(filePath);
    var modules = [];
    var array = [...data.toString().matchAll(reg1)];
    for (var index in array) {
        if (!isFromFile(array[index][2])) {
            if (array[index][2].indexOf(module) >= 0) {
                modules.push([array[index][0], array[index][1], array[index][2], isFromFile(array[index][2])]);
            }
        }
    }

    array = [...data.toString().matchAll(reg2)];

    // if (module == "react-dev-utils" && filePath.indexOf('getHttpsConfig') >= 0)
    //     console.log(array);

    for (var index in array) {
        if (!isFromFile(array[index][2])) {
            // console.log(array[index][2],module,array[index][2].indexOf(module))
            if (array[index][2].indexOf(module) >= 0) {
                modules.push([array[index][0], array[index][1], array[index][2], isFromFile(array[index][2])]);
            }
        }
    }

    //  console.log(filePath, module, modules)
    return modules.length > 0;
}


//################################## Stage Four

function StageFour_NormalizeList(lst, callback) {
    if (options.cache) {
        var json = fs.readFileSync("result-normalized.json");
        json = JSON.parse(json);
        callback(json)
        return;
    }


    var normalizedList = [];
    for (var index in lst) {

        var record = normalizedList.filter((value) => {
            return value.module == lst[index].module;
        });

        if (record && record.length > 0) {
            record = record[0];
            record.dependOn.push({
                'module': lst[index].depend.module,
                'version': lst[index].depend.version,
                versions: lst[index].versions
            })
        }
        else {
            record = {
                'module': lst[index].module,
                'version': lst[index].version,
                dependOn: [{
                    'module': lst[index].depend.module,
                    'version': lst[index].depend.version,
                    versions: lst[index].versions
                }]
            };
        }

        normalizedList.push(record)
    }


    fs.writeFileSync("result-normalized.json", JSON.stringify(normalizedList))
    callback(normalizedList);
}


function makeResultJson(normalizePackages, files, callback) {
    var table = [];
    for (var i in normalizePackages) {

        // var item = table.filter((value) => {
        //     return (value.Module == normalizePackages[i].module)
        // });

        // if (!item || item.length <= 0) {
        var item = {
            Module: normalizePackages[i].module,
            Version: normalizePackages[i].version,
            Dependencies: [],
            Usages: [],
        };

        for (var f in files) {
            var file = files[f];
            if (parseJsFile(file.path, normalizePackages[i].module)) {
                item.Usages.push(file.path);
            }
        }
        // }
        // else {
        //     item = item[0];
        // }

        for (var iDepend in normalizePackages[i].dependOn)
        {
            var dependency = {
                Module: normalizePackages[i].dependOn[iDepend].module,
                Version: normalizePackages[i].dependOn[iDepend].version,
                AvailableVersions: [],
                // x: normalizePackages[i]
            };
    
            for (var j in normalizePackages[i].dependOn[iDepend].versions) {
    
                var xx = dependency.AvailableVersions.filter((value, index) => {
                    return value.version == normalizePackages[i].dependOn[iDepend].versions[j].version
                });
                if (!xx || xx.length <= 0) {
    
                    dependency.AvailableVersions.push({
                        version: normalizePackages[i].dependOn[iDepend].versions[j].version,
                        match: normalizePackages[i].dependOn[iDepend].versions[j].match,
                        depend: normalizePackages[i].dependOn[iDepend].versions[j].depend
                    })
                }
    
            }
    
    
            item.Dependencies.push(dependency);
    
        }

        //CALC USAGE
        // console.log(files)

        table.push(item);
    }

    fs.writeFileSync("report.html", pugCompiledFunction({
        table: table
    }));
    console.log("normalizePackages:", table[0])
}