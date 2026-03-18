import type { Parent, Root, Node, Text, RootContent } from 'mdast';
import { MdxJsxFlowElement } from 'mdast-util-mdx-jsx';
import { valueToEstree } from 'estree-util-value-to-estree';

export interface DefaultMap {
    [key: string]: string;
}

export interface HiddenTabOptions {
    defaults?: DefaultMap;
}

// function switchView(key, value) {
//     for (const element of document.getElementsByClassName(`hiddentab__${key}`)) {
//         if (element.classList.contains(value)) {
//       element.style.removeProperty('display');
//     } else {
//       element.style.setProperty('display', 'none');
//     }
//   }
// } 

export default function remarkHiddenTabs(options?: HiddenTabOptions) {

    function checkForReplacement(element: Text, parent: Parent, divStack: [MdxJsxFlowElement, Parent][]): boolean {
        // If child is text, check for matching string
        const match: RegExpMatchArray = element.value.match(/(\^|\$)tab(?: ([^ ]+) ([^ ]+))?/);
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
                div.attributes.push({
                    type: 'mdxJsxAttribute',
                    name: 'class',
                    value: `hiddentab__${group} ${value}`
                });

                // Add hidden attribute
                if (!(options.defaults && group in options.defaults && options.defaults[group] === value)) {
                    const displayAttr: object = {
                        display: 'none'
                    };
                    div.attributes.push({
                        type: 'mdxJsxAttribute',
                        name: 'style',
                        value: {
                            type: 'mdxJsxAttributeValueExpression',
                            value: JSON.stringify(displayAttr),
                            data: {
                                estree: {
                                    type: 'Program',
                                    body: [
                                        {
                                            type: 'ExpressionStatement',
                                            expression: valueToEstree(displayAttr)
                                        }
                                    ],
                                    sourceType: 'module'
                                }
                            }
                        },
                    });
                }

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
        replaceHiddenTabs(tree, { value: 0 }, []);
    }
}