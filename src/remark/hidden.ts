import type { Parent, Root, Node, Text, RootContent } from 'mdast';
import { MdxJsxFlowElement } from 'mdast-util-mdx-jsx';

export interface DefaultMap {
    [key: string]: string;
}

export interface HiddenTabOptions {
    defaults?: DefaultMap;
}

export function loadTabDisplays(params?: URLSearchParams) {
    for (let i = 0; i < localStorage.length; i++) {
        const key: string = localStorage.key(i);
        if (key.startsWith('hiddentab__key_')) {
            _switchTab(key, localStorage.getItem(key));
        }
    }

    if (params) {
        for (const [key, value] of params.entries()) {
            switchTab(key, value);
        }
    }
}

export function switchTab(key: string, value: string) {
    key = `hiddentab__key_${key}`;
    value = `hiddentab__value_${value}`;
    if (_switchTab(key, value)) {
        localStorage.setItem(key, value);
    }
}

function _switchTab(key: string, value: string): boolean {
    if (!key.match(/^[A-Za-z0-9\-_]+$/) || !value.match(/^[A-Za-z0-9\-_]+$/)) return false;

    let elementToSwitch: boolean = false;
    for (const element of document.getElementsByClassName(key)) {
        elementToSwitch = true;
        if (element.classList.contains(value)) {
            element.classList.remove('hiddentab__hidden')
        } else if (!element.classList.contains('hiddentab__hidden')) {
            element.classList.add('hiddentab__hidden');
        }
    }
    return elementToSwitch;
}

export default function remarkHiddenTabs(options?: HiddenTabOptions) {

    function checkForReplacement(element: Text, parent: Parent, divStack: [MdxJsxFlowElement, Parent][]): boolean {
        // If child is text, check for matching string
        const match: RegExpMatchArray = element.value.match(/(\^|\$)tab(?: ([A-Za-z0-9\-_]+) ([A-Za-z0-9\-_]+))?/);
        if (match) {
            const [_, markerType, group, value] = match;

            // Is start of new div?
            if (markerType === '^') {
                // Construct div
                const div: MdxJsxFlowElement = {
                    type: 'mdxJsxFlowElement',
                    name: 'div',
                    attributes: [],
                    children: []
                };

                // Add class attribute
                const attributes: string[] = []
                attributes.push(`hiddentab__key_${group}`);
                attributes.push(`hiddentab__value_${value}`);
                if (!(options.defaults && group in options.defaults && options.defaults[group] === value)) {
                    attributes.push('hiddentab__hidden');
                }
                div.attributes.push({
                    type: 'mdxJsxAttribute',
                    name: 'className',
                    value: attributes.join(' ')
                });

                // Push div onto stack
                divStack.push([div, parent]);
            } else if (markerType === '$') {
                // Pop div from stack
                const [div, parent] = divStack.pop();
                parent.children.push(div);
            }


            return true;
        }

        return false;
    }

    function replaceHiddenTabs(node: Parent, divStack: [MdxJsxFlowElement, Parent][]): boolean {
        // Store the node map to replace
        const result: Node[] = [];

        let appliedReplacement: boolean = false;
        for (const child of node.children) {
            if (child.type === 'text' && checkForReplacement(child as Text, node, divStack)) {
                appliedReplacement = true;
                continue;
            }

            // Otherwise, handle children as normal

            // Depth-first search on children
            if (Object.hasOwn(child, 'children')) {
                const parent: Parent = child as Parent;
                const replaced: boolean = replaceHiddenTabs(parent, divStack);

                // Skip if there was a replacement leaving no children
                if (replaced && parent.children.length == 0) {
                    for (const divCtx of divStack) {
                        if (divCtx[1] === parent) {
                            divCtx[1] = node;
                        }
                    }
                    continue;
                }
            }

            // Push to appropriate array.
            const nodeArray: Node[] = divStack.length > 0 ? divStack.at(-1)[0].children : result;
            nodeArray.push(child);
        }

        node.children = result as RootContent[];
        return appliedReplacement;
    }

    return function (tree: Root) {
        replaceHiddenTabs(tree, []);
    }
}