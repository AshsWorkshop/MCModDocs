import { definePlugin, ExpressiveCodePlugin } from 'rehype-expressive-code';
import path from 'node:path';
import * as fs from 'node:fs';

const __DEFAULT_SEPARATOR: string = ',';
const __REGEX: RegExp = /^~>\[([^\[\]\(\)]*)\]\(([^\[\]\(\)]+)\)$/;

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
}

interface Resolutions {
    [index: number]: string[];
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
                        const [_, resolver, reference] = match;
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
                                const data: string[] = fs.readFileSync(
                                    filePath, { encoding: 'utf-8' }
                                ).trim().split('\n');
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