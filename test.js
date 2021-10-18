function stageOne_ReadAllPackages({ guideJson, packageJson, packageLockJson }) {

    var markedPackageModules = [];

    for (var index in guideJson) {
        var moduleFromGuide = guideJson[index];

        if (packageJson.dependencies[moduleFromGuide.module]) {
            for (var index2 in moduleFromGuide.from) {
                if (convertVersion(moduleFromGuide.from[index2]) >= convertVersion(packageJson.dependencies[moduleFromGuide.module])) {
                    
                    
                    
                    
                    if (markedPackageModules[moduleFromGuide.module] == undefined) {
                        markedPackageModules[moduleFromGuide.module] = {
                            "module": guideJson[index].module,
                            "from": guideJson[index].from,
                            "to": guideJson[index].to
                        };
                        markedPackageModules[moduleFromGuide.module]['modules'] = [];
                    }

                    var json = {
                        "module": moduleFromGuide.module,
                        "version": packageJson.dependencies[moduleFromGuide.module],
                        "rules": guideJson[index]
                    };
                    // json["obtainGit"] = moduleObtainGitFromNpm(moduleFromGuide.module);
                    // json["obtainVersions"] = moduleObtainVersions();
                    // json["obtainPackage"] = moduleReadPackageFromGit();

                    markedPackageModules[moduleFromGuide.module]['modules'].push(json);
                    break;
                }
            }
        }

        for (var ModuleName in packageLockJson.dependencies) {
            for (var ModuleRequiredName in packageLockJson.dependencies[ModuleName].requires) {

                if (guideJson[index].module == ModuleRequiredName) {

                    for (var index2 in guideJson[index].from) {
                        if (convertVersion(guideJson[index].from[index2]) >= convertVersion(packageLockJson.dependencies[ModuleName].requires[ModuleRequiredName])) {

                            if (markedPackageModules[ModuleRequiredName] == undefined) {
                                markedPackageModules[ModuleRequiredName] = {
                                    "module": guideJson[index].module,
                                    "from": guideJson[index].from,
                                    "to": guideJson[index].to
                                };
                                markedPackageModules[ModuleRequiredName]['modules'] = [];
                            }

                            var json = {
                                "parent": {
                                    "module": ModuleName,
                                    "version": packageLockJson.dependencies[ModuleName].version,

                                },
                                "rules": guideJson[index],
                                "module": ModuleRequiredName,
                                "version": packageLockJson.dependencies[ModuleName].requires[ModuleRequiredName],

                            };
                            // json["obtainGit"] = moduleObtainGitFromNpm(ModuleName);
                            // json["obtainVersions"] = moduleObtainVersions();
                            // json["obtainPackage"] = moduleReadPackageFromGit();

                            markedPackageModules[moduleFromGuide.module]['modules'].push(json);
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
        if (markedPackageModules[guideJson[index].module] == undefined) {
            notfound.push(guideJson[index])
        }
    }

    return [markedPackageModules, notfound];
}
