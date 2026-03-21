import { definePlugin, ExpressiveCodePlugin } from 'rehype-expressive-code';
import path from 'node:path';
import * as fs from 'node:fs';

const __DEFAULT_SEPARATOR: string = ',';
const __REGEX: RegExp = /^~>\[([^\[\]\(\) ]*)((?: [^\[\]\(\)= ]+=[^\[\]\(\)= ]+)*)\]\(([^\[\]\(\)]+)\)$/;

export interface Replacements {
    [key: string]: string;
}

export interface ResolverDefinition {
    // A path that defines the location relative to the base.
    // Use {<index>} to define dynamic components from the reference.
    locations: string[];
    // Defines the separator used within a reference.
    // Defaults to reference separator
    separator?: string;
    // Defines what part of the key should be replaced with another
    replacements?: Replacements;
}

export interface ResolverDictionary {
    [resolverKey: string]: (string | ResolverDefinition);
}

export interface PluginResolverOptions {
    // Location resolutions should begin from
    baseLocation: string;
    // Separator to use in a reference.
    // Defaults to ','
    referenceSeparator?: string;
    // A dictionary of resolvers to provider short references for.
    resolvers?: ResolverDictionary;
    // Defines the clip identifier to check for.
    // Any other clips with the specified prefix will be stripped.
    clipPrefix?: string;
}

interface Resolutions {
    [index: number]: string[];
}

function clipText(text: string, data: string[], prefix?: string): string[] {
    // Append prefix
    text = (prefix ?? '') + text;
    
    const result: string[] = [];

    let foundData: boolean = false;
    let contentBetween: boolean = false;

    let trimWhitespace: number = -1;
    let pushData: boolean = false;
    for (const [index, line] of data.entries()) {
        let startIndex = -1;
        if (line.includes(text)) {
            foundData = true;
            contentBetween = false;

            pushData = !pushData;
            startIndex = index;
            if (trimWhitespace == -1) {
                trimWhitespace = line.search(/\S/);
                trimWhitespace = trimWhitespace == -1 ? 0 : trimWhitespace;
            }
        }

        if (foundData && !pushData && !contentBetween && line.search(/\S/) != -1) {
            contentBetween = true;
            result.push(' '.repeat(line.search(/\S/) - trimWhitespace) + '// ...');
        }

        if (prefix && line.includes(prefix)) {
            continue;
        }

        if (pushData && startIndex != index) {
            result.push(
                line.substring(Math.min(trimWhitespace, line.search(/\S/)))
            );
        }
    }

    return result;
}

export function pluginResolver(options: PluginResolverOptions): ExpressiveCodePlugin {
    const cwd: string = path.join(process.cwd(), options.baseLocation);
    return definePlugin({
        name: 'Resolves code blocks from files, e.g. ~>[resolver](reference)',
        hooks: {
            preprocessCode: (context) => {
                const toResolve: Resolutions = {};

                // Find entries to replace
                for (const [index, line] of context.codeBlock.getLines().entries()) {
                    const match = line.text.match(__REGEX);
                    if (match) {
                        const [_, resolver, meta, reference] = match;
                        let locations: string[] = [reference];

                        // If the resolver is non-empty
                        if (options.resolvers && resolver && resolver in options.resolvers) {
                            const def: string | ResolverDefinition = options.resolvers[resolver]
                            locations = (typeof def === "string") ? [def] : Object.assign([], def.locations);
                            let separator: string = options.referenceSeparator ?? __DEFAULT_SEPARATOR;
                            if (!(typeof def === "string")) {
                                separator = def.separator ?? separator;
                            }
                            const replacements: Replacements = (typeof def === "string") ? {} : (def.replacements ?? {});

                            // Apply replacements
                            let ref: string = reference;
                            for (const [replacementKey, replacementValue] of Object.entries(replacements)) {
                                ref = ref.replaceAll(replacementKey, replacementValue);
                            }

                            // Apply resolver
                            const refEntries: string[] = ref.split(separator);
                            for (const locationIdx in locations) {
                                for (const [referenceIdx, value] of refEntries.entries()) {
                                    locations[locationIdx] = locations[locationIdx].replace('{' + referenceIdx + '}', value);
                                }
                            }
                        }

                        for (const location of locations) {
                            let filePath = path.join(cwd, location);
                            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                                let data: string[] = fs.readFileSync(
                                    filePath, { encoding: 'utf-8' }
                                ).trim().split('\n');

                                // Compute meta to apply to data
                                if (meta) {
                                    const properties: string[] = meta.substring(1).split(' ');
                                    for (const property of properties) {
                                        const [propertyKey, propertyValue] = property.split('=');
                                        if (propertyKey === 'clip-text') {
                                            data = clipText(propertyValue, data, options.clipPrefix);
                                            data.pop();
                                        }
                                    }
                                }

                                // Trim any whitespace
                                while (data[0] !== undefined && !data[0]) {
                                    data = data.slice(1);
                                }
                                while (data.at(-1) !== undefined && !data.at(-1)) {
                                    data.pop();
                                }

                                if (!context.codeBlock.props.title) {
                                    context.codeBlock.props.title = path.basename(filePath);
                                }
                                

                                // Add resolution
                                toResolve[index] = data;

                                break;
                            }
                        }
                    }
                }

                // Replace entries
                Object.entries(toResolve).map(([index, data]) => {
                    const idx: number = parseInt(index);
                    context.codeBlock.deleteLine(idx);
                    context.codeBlock.insertLines(idx, data);
                });
            }
        }
    })
}