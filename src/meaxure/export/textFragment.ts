// Copyright 2020 Jebbs. All rights reserved.
// Use of this source code is governed by the MIT
// license that can be found in the LICENSE file.

import { ArtboardData } from "../interfaces"; import { sketch } from "../../sketch";
import { tempCreatedLayers } from ".";
import { getLayerData } from "./layerData";
import { TextFragment } from "../../sketch/text/textFragment";
import { Edge, EdgeVertical } from "../../sketch/layer/alignment";

export function getTextFragment(artboard: Artboard, layer: Text, data: ArtboardData) {
    if (layer.type != sketch.Types.Text) return;
    let fragments = layer.getFragments();
    if (fragments.length < 2) return;

    let offsetFragmentsY = 0;
    let textFrame = layer.frame;
    let heightIfSingleLine = layer.style.lineHeight || Math.max(...fragments.map(f => f.defaultLineHeight));
    let lines: TextFragment[][];
    if (textFrame.height > heightIfSingleLine) {
        // only getFragmentsByLines when multi-line
        lines = getFragmentsByLines(layer, fragments);
    } else {
        lines = [fragments];
    }
    let textGroup: Group = new sketch.Group({ parent: artboard });
    textGroup.hidden = true;
    tempCreatedLayers.push(textGroup);

    for (let frags of lines) {
        if (frags == null) {
            // it's a new paragraph
            offsetFragmentsY += layer.style.paragraphSpacing;
            continue;
        }
        let offsetFragmentsX = 0;
        let lineGroup = new sketch.Group({ parent: textGroup });
        lineGroup.frame.x = 0;
        lineGroup.frame.y = offsetFragmentsY;
        let currentLineHeight = layer.style.lineHeight || Math.max(...frags.map(f => f.defaultLineHeight));
        for (let fragment of frags) {
            fragment.style.fills.forEach(fill => {
                // https://github.com/qjebbs/sketch-meaxure/issues/2
                // https://github.com/sketch-hq/SketchAPI/issues/726
                if (fill.pattern && fill.pattern.image === null) fill.pattern.image = undefined;
            });
            let subText = new sketch.Text({ text: fragment.text, parent: lineGroup });
            subText.style = fragment.style;
            subText.style.lineHeight = currentLineHeight;
            subText.frame.x = offsetFragmentsX;
            subText.frame.y = 0;
            offsetFragmentsX += subText.frame.width;
        }
        lineGroup.adjustToFit();
        offsetFragmentsY += currentLineHeight;
    }
    switch (layer.style.alignment) {
        case sketch.Text.Alignment.center:
            for (let line of textGroup.layers) {
                line.alignTo(
                    layer,
                    { from: Edge.center, to: Edge.center },
                    false
                )
            }
            break;
        case sketch.Text.Alignment.right:
            for (let line of textGroup.layers) {
                line.alignTo(
                    layer,
                    { from: Edge.right, to: Edge.right },
                    false
                )
            }
            break;
        default:
            break;
    }
    textGroup.adjustToFit();
    switch (layer.style.verticalAlignment) {
        case sketch.Text.VerticalAlignment.top:
            textGroup.alignTo(
                layer,
                { from: Edge.left, to: Edge.left },
                { from: EdgeVertical.top, to: EdgeVertical.top },
            )
            break;
        case sketch.Text.VerticalAlignment.center:
            textGroup.alignTo(
                layer,
                { from: Edge.left, to: Edge.left },
                { from: EdgeVertical.middle, to: EdgeVertical.middle },
            )
            break;
        case sketch.Text.VerticalAlignment.bottom:
            textGroup.alignTo(
                layer,
                { from: Edge.left, to: Edge.left },
                { from: EdgeVertical.bottom, to: EdgeVertical.bottom },
            )
            break;
        default:
            break;
    }
    for (let text of sketch.find<Text>('Text', textGroup)) {
        getLayerData(artboard, text, data, false);
    }
    textGroup.remove();
}
function getFragmentsByLines(layer: Text, fragments: TextFragment[]): TextFragment[][] {
    let svg = (
        sketch.export(layer, { output: undefined, formats: 'svg' }) as Buffer
    ).toString();
    let lines = getFragmentLinesFromSVG(svg);
    let fragmentsByLines: TextFragment[][] = [];
    let currentFragment: TextFragment = undefined;
    let isPrevNewLine: boolean = false;
    for (let line of lines) {
        let lineFragments = [];
        for (let element of line.elements) {
            if (!currentFragment) currentFragment = fragments.shift();
            while (currentFragment.text.startsWith('\n')) {
                // if currentFragment.text start with \n, it creates a new line, which doesn't appear in svg.
                // so just push a null (presents a new paragraph) for it, and split the fragment
                let leftPart: TextFragment;
                [leftPart, currentFragment] = splitFragment(currentFragment, '\n');
                if (isPrevNewLine) fragmentsByLines.push([]);
                // push a null to represent a new paragraph
                fragmentsByLines.push(null);
                if (!currentFragment) currentFragment = fragments.shift();
                isPrevNewLine = true;
            }
            if (element.length == currentFragment.text.length) {
                // push and process next fragment
                lineFragments.push(currentFragment);
                currentFragment = undefined;
            } else {
                // element is short than fragment, fragment wrapped
                let leftPart: TextFragment;
                [leftPart, currentFragment] = splitFragment(currentFragment, element);
                lineFragments.push(leftPart);
            }
            isPrevNewLine = false;
        }
        fragmentsByLines.push(lineFragments);
    }
    return fragmentsByLines;
}
function splitFragment(fragment: TextFragment, splitText: string): [TextFragment, TextFragment] {
    let left = Object.assign({}, fragment);
    left.length = splitText.length
    left.text = splitText;
    fragment.text = fragment.text.substring(left.length)
    fragment.location += left.length;
    fragment.length -= left.length;
    if (fragment.length < 0) throw new Error('splitFragment: fragment splitted to negtive length');
    if (!fragment.length) fragment = undefined;
    return [left, fragment];
}

function getFragmentLinesFromSVG(svg: string) {
    const REG_TSPAN = /<tspan x="(\d+(?:\.\d+)?)" y="(\d+(?:\.\d+)?)" .+?>(.+?)<\/tspan>/g
    let curY = undefined;
    let lines: { elements: string[] }[] = [];
    let lineElements: string[] = [];
    let execArray: RegExpExecArray;
    while (execArray = REG_TSPAN.exec(svg)) {
        let x = parseFloat(execArray[1]);
        let y = parseFloat(execArray[2]);
        let text = execArray[3];
        if (curY === undefined) {
            curY = y;
        } else if (curY !== y) {
            // next line now
            lines.push({
                elements: lineElements,
            });
            lineElements = [text];
            curY = y;
            continue;
        }
        // current line
        lineElements.push(text);
    }
    // push the last line
    lines.push({
        elements: lineElements,
    });
    return lines;
}