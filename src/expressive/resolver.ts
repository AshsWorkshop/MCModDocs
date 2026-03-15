import { definePlugin, ExpressiveCodePlugin } from 'rehype-expressive-code';
import path from 'node:path';
import * as fs from 'node:fs';

const __DEFAULT_SEPARATOR: string = ',';
const __REGEX: RegExp = /^~>\[([^\[\]\(\) ]*)((?: [^\[\]\(\)= ]+=[^\[\]\(\)= ]+)*)\]\(([^\[\]\(\)]+)\)$/;

export interface ResolverDefinition {
    // A path that defines the location relative to the base.
    // Use {<index>} to define dynamic components from the reference.
    locations: string[];
    // Defines the separator used within a reference.
    // Defaults to reference separator
    separator?: string;
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

    let trimWhitespace: number = 0;
    let pushData: boolean = false;
    for (const [index, line] of data.entries()) {
        let startIndex = -1;
        if (line.includes(text)) {
            pushData = !pushData;
            startIndex = index;
            trimWhitespace = line.search(/\S/);
            trimWhitespace = trimWhitespace == -1 ? 0 : trimWhitespace;
        }

        if (prefix && line.includes(prefix)) {
            continue;
        }

        if (pushData && startIndex != index) {
            result.push(line.substring(trimWhitespace));
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
                        const [_, resolver, meta, reference]  = match;
                        let locations: string[] = [reference];

                        // If the resolver is non-empty
                        if (options.resolvers && resolver && resolver in options.resolvers) {
                            const def: string | ResolverDefinition = options.resolvers[resolver]
                            locations = (typeof def === "string") ? [(def as string)] : Object.assign([], (def as ResolverDefinition).locations);
                            let separator: string = options.referenceSeparator ?? __DEFAULT_SEPARATOR;
                            if (!(typeof def === "string")) {
                                separator = (def as ResolverDefinition).separator ?? separator;
                            }

                            // Apply resolver
                            const refEntries: string[] = reference.split(separator);
                            for (const locationIdx in locations) {
                                for (const [referenceIdx, value] of reference.split(separator).entries()) {
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
                                        }
                                    }
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