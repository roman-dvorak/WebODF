/**
 * Copyright (C) 2012 KO GmbH <jos.van.den.oever@kogmbh.com>
 * @licstart
 * The JavaScript code in this page is free software: you can redistribute it
 * and/or modify it under the terms of the GNU Affero General Public License
 * (GNU AGPL) as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.  The code is distributed
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU AGPL for more details.
 *
 * As additional permission under GNU AGPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * As a special exception to the AGPL, any HTML file which merely makes function
 * calls to this code, and for that purpose includes it by reference shall be
 * deemed a separate work for copyright law purposes. In addition, the copyright
 * holders of this code give you permission to combine this code with free
 * software libraries that are released under the GNU LGPL. You may copy and
 * distribute such a system following the terms of the GNU AGPL for this code
 * and the LGPL for the libraries. If you modify this code, you may extend this
 * exception to your version of the code, but you are not obligated to do so.
 * If you do not wish to do so, delete this exception statement from your
 * version.
 *
 * This license applies to this entire compilation.
 * @licend
 * @source: http://www.webodf.org/
 * @source: http://gitorious.org/webodf/webodf/
 */
/*global xmled, runtime, console*/

runtime.loadClass("xmled.XsdChecker");

/**
 * @constructor
 * @param {!Document|!Element} documentNode
 * @param {?Node} targetNode
 */
xmled.ValidationState = function ValidationState(documentNode, targetNode) {
    "use strict";
    var self = this,
        xsdns = "http://www.w3.org/2001/XMLSchema",
        defs = [],
        poss = [],
        occs = [],
        isDone = false;
    /**
     * @const @type {!Node}
     */
    this.documentNode = documentNode;
    /**
     * @const @type {?Node}
     */
    this.targetNode = targetNode;
    /**
     * @type {?Node}
     */
    this.currentNode = null;
    /**
     * @type {?string}
     */
    this.error = null;
    /**
     * @type {!boolean}
     */
    this.mixed = false;
    /**
     * @param {!Element} def
     * @return {undefined}
     */
    this.push = function (def) {
        var name = def.localName;
        runtime.assert(def.namespaceURI === xsdns, "def has wrong namespace");
        runtime.assert(defs.length !== 0
            || (name === "element" && def.parentNode.localName === "schema"),
            "First element should be top level element");
        runtime.assert(name === "sequence" || name === "choice"
            || name === "element" || name === "any",
            "Invalide definition pushed.");
        defs.push(def);
        poss.push(0);
        occs.push(1);
    };
    /**
     * @return {!boolean}
     */
    this.checkDone = function () {
        isDone = isDone || targetNode === self.currentNode;
        return isDone;
    };
    /**
     * @return {!boolean}
     */
    function done() {
        return isDone || self.error !== null;//targetNode === self.currentNode;
    }
    this.done = done;
    /**
     * @return {undefined}
     */
    this.pop = function () {
        if (!done()) {
            defs.pop();
            poss.pop();
            occs.pop();
        }
    };
    /**
     * @return {undefined}
     */
    this.topPosReset = function () {
        poss[poss.length - 1] = 0;
    };
    /**
     * @return {!Array.<!Element>}
     */
    this.defs = function () {
        return defs;
    };
    /**
     * @return {!number}
     */
    this.length = function () {
        return defs.length;
    };
    /**
     * @param {!number} pos
     * @return {!Element}
     */
    this.def = function (pos) {
        return defs[pos];
    };
    /**
     * @param {!number} pos
     * @return {!number}
     */
    this.pos = function (pos) {
        return poss[pos];
    };
    /**
     * @return {!Element}
     */
    this.topDef = function () {
        return defs[defs.length - 1];
    };
    /**
     * @return {!Element}
     */
    this.topPos = function () {
        return poss[poss.length - 1];
    };
    /**
     * Returns the current occurrence of top definition.
     * @return {!number}
     */
    this.topOccurrence = function () {
        return occs[occs.length - 1];
    };
    /**
     * Advance the state to the next occurrence of the current definition.
     * @return {undefined}
     */
    this.topNextOccurrence = function () {
        occs[occs.length - 1] += 1;
    };
};
/**
 * @constructor
 * @param {!number} id
 * @param {!Element} element
 * @param {!number=} offset
 * @param {!xmled.Particle=} parent
 */
xmled.Particle = function Particle(id, element, offset, parent) {
    "use strict";
    this.id = id;
    this.element = element;
    this.offset = offset;
    this.parent = parent;
};
/**
 * @constructor
 */
xmled.ParticleCache = function ParticleCache() {
    "use strict";
    var rootParticles = {},
        particles = [];
    /**
     * @param {!Element} element
     * @param {!number=} offset
     * @param {!xmled.Particle=} parent
     * @return {!xmled.Particle}
     */
    this.getParticle = function (element, offset, parent) {
        var n = element.localName,
            p,
            ps;
        runtime.assert(n === "element" || n === "group" || n === "all"
                || n === "choice" || n === "sequence" || n === "any",
                "Unexpected element '" + n + "'.");
        if (!parent) { // asking for a root particle
            p = rootParticles[element.localName];
            if (!p) {
                p = new xmled.Particle(particles.length, element);
                particles.push([]);
                rootParticles[element.localName] = p;
            }
        } else {
            ps = particles[parent.id];
            if (ps.length > offset) {
                p = ps[offset];
            } else {
                p = new xmled.Particle(particles.length, element, offset,
                        parent);
                particles.push([]);
            }
        }
        return p;
    };
};
/**
 * @constructor
 * @param {!xmled.Particle} particle
 */
xmled.ParticleSearchState = function ParticleSearchState(particle) {
    "use strict";
    var self = this;
    /**@type{!xmled.Particle}*/
    this.particle = particle;
    /**@type{!number}*/
    this.offset = 0;
    /**@type{?Element}*/
    this.element = null;
    /**@type{!Array.<!xmled.Particle>}*/
    this.particles = [];
    /**@type{?string}*/
    this.error = null;
    /**
     * @param {!xmled.Particle} particle
     * @param {?Element} element
     * @param {!number} offset
     * @return {undefined}
     */
    this.set = function (particle, element, offset) {
        self.offset = offset;
        self.particle = particle;
        self.element = element.firstElementChild;
        self.particles = [];
        self.particles.length = element.childElementCount;
    };
    /**
     * @return {!boolean}
     */
    this.done = function () {
        return self.offset === self.particles.length || self.error !== null;
    };
};
/**
 * @constructor
 * @param {!string} grammarurl
 * @param {function(?string):undefined=} onready
 */
xmled.ValidationModel = function ValidationModel(grammarurl, onready) {
    "use strict";
    var modelState = xmled.ValidationModel.State.LOADING,
        xsdns = "http://www.w3.org/2001/XMLSchema",
        error,
        xsd,
        targetNamespace = null,
        checker = new xmled.XsdChecker(),
        particles = new xmled.ParticleCache(),
        validateCollectionUpToNode,
        validateComplexTypeUpToNode,
        fillElementWithDefaults,
        findParticlesInCollection;
    /**
     * @return {!xmled.ValidationModel.State}
     */
    this.getState = function () {
        return modelState;
    };
    /**
     * @return {?string}
     */
    this.getError = function () {
        return error;
    };
    function getDocumentation(e) {
        var es = e.getElementsByTagNameNS(xsdns, "documentation"),
            doc = "",
            i;
        for (i = 0; i < es.length; i += 1) {
            doc += es.item(i).textContent + "<br/>";
        }
        return doc;
    }
    /**
     * @param {!string} qname
     * @return {!string}
     */
    function getLocalName(qname) {
        var i = qname.indexOf(':');
        return (i === -1) ? qname : qname.substr(i + 1);
    }
    /**
     * @param {!string} qname
     * @return {!Element}
     */
    function findRootElement(qname) {
        var e = xsd.firstElementChild,
            localName = getLocalName(qname);
        while (e && !(e.localName === "element"
                && e.getAttribute("name") === localName)) {
            e = e.nextElementSibling;
        }
        if (!e) {
            throw "Element not found.";
        }
        return e;
    }
    /**
     * @param {!string} qname
     * @return {!Element}
     */
    function findType(qname) {
        var e = xsd.firstElementChild,
            localName = getLocalName(qname);
        while (e && !((e.localName === "simpleType"
                       || e.localName === "complexType")
                      && e.getAttribute("name") === localName)) {
            e = e.nextElementSibling;
        }
        if (!e) {
            throw "Type not found.";
        }
        return e;
    }
    /**
     * @param {!Element} groupRef
     * @return {!Element}
     */
    function findGroup(groupRef) {
        var e = xsd.firstElementChild,
            qname = groupRef.getAttribute("ref"),
            localName = getLocalName(qname);
        while (e && !(e.localName === "group"
                && e.getAttribute("name") === localName)) {
            e = e.nextElementSibling;
        }
        if (!e) {
            throw "Group not found.";
        }
        return e;
    }
    /**
     * @param {!Element} groupRef
     * @return {!Element}
     */
    function findGroupCollection(groupRef) {
        var e = /**@type{!Element}*/(findGroup(groupRef).lastElementChild);
        return e;
    }
    /**
     * @param {!NodeList} list
     * @param {!string} name
     * @return {?Element}
     */
    function getElementWithName(list, name) {
        var i, e;
        for (i = 0; i < list.length; i += 1) {
            e = /**@type{!Element}*/(list.item(i));
            if (e.getAttribute("name") === name) {
                return e;
            }
        }
        return null;
    }
    /**
     * @param {!string} qname
     * @return {?Element}
     */
    function findElement(qname) {
        var localName = getLocalName(qname),
            es = xsd.getElementsByTagNameNS(xsdns, "element");
        return getElementWithName(es, localName);
    }
    function findAttributeGroup(name) {
        var es = xsd.getElementsByTagNameNS(xsdns, "attributeGroup"),
            e,
            i;
        for (i = 0; i < es.length; i += 1) {
            e = es.item(i);
            if (e.getAttribute("name") === name) {
                return e;
            }
        }
        return null;
    }
    function findAttribute(name) {
        var es = xsd.getElementsByTagNameNS(xsdns, "attribute"),
            e,
            i;
        for (i = 0; i < es.length; i += 1) {
            e = es.item(i);
            if (e.getAttribute("name") === name) {
                return e;
            }
        }
        return null;
    }
    function getType(attribute) {
        if (!attribute) {
            return null;
        }
        var e = attribute.firstChild,
            enumeration = []; 
        while (e && e.localName !== "simpleType") {
            e = e.nextSibling;
        }
        e = e && e.firstChild;
        while (e && e.localName !== "restriction") {
            e = e.nextSibling;
        }
        if (!e) {
            return null;
        }
        e = e.firstChild;
        while (e) {
            if (e.localName === "enumeration") {
                enumeration.push(e.getAttribute("value"));
            }
            e = e.nextSibling;
        }
        if (enumeration.length) {
            return { name: "enumeration", values: enumeration };
        }
        return null;
    }
    /**
     * Return a description for the given element.
     * @param {!Element} element
     * @return {!string}
     */
    this.getElementInfo = function (element) {
        var e = findElement(element.localName),
            doc = "<i>" + element.localName + "</i>";
        if (e) {
            doc += "<br/>" + getDocumentation(e);
        }
        return doc;
    };
    function collectAttributeDefinitions(e, atts, element) {
        e = e && e.firstChild;
        var localName, value, att;
        while (e) {
            if (e.localName === "attribute") {
                att = e;
                if (!e.hasAttribute("name")) {
                    att = findAttribute(e.getAttribute("ref"));
                }
                localName = att ? att.getAttribute("name") : null;
                value = (element.hasAttribute(localName)) ? element.getAttribute(localName) : null;
                atts.push({
                    localName: localName,
                    value: value,
                    type: getType(att)
                });
            } else if (e.localName === "attributeGroup") {
                collectAttributeDefinitions(
                    findAttributeGroup(e.getAttribute("ref")),
                    atts,
                    element
                );
            }
            e = e.nextSibling;
        }
    }
    function getAttributeDefinitions(element) {
        var e = findElement(element.localName),
            atts = [],
            complexType;
        if (!e) {
            return atts;
        }
        complexType = e.firstChild;
        while (complexType && complexType.localName !== "complexType") {
            complexType = complexType.nextSibling;
        }
        if (!complexType) {
            return atts;
        }
        collectAttributeDefinitions(complexType, atts, element);
        return atts;
    }
    /**
     * @param {!Element} element
     * @return {!Array}
     */
    this.getAttributeDefinitions = function (element) {
        var a = [], e = element, ns = element.namespaceURI, atts;
        while (e && e.namespaceURI === ns && e.parentNode !== e) {
            atts = getAttributeDefinitions(e);
            a.push({name: e.localName, atts: atts});
            e = e.parentNode;
        }
        return a;
    };
    function getAllowedElements(e, allowed) {
        e = e.firstElementChild;
        while (e) {
            if (e.localName === "element") {
                if (e.hasAttribute("name")) {
                    allowed[e.getAttribute("name")] = 1;
                } else if (e.hasAttribute("ref")) {
                    allowed[e.getAttribute("ref")] = 1;
                }
            } else {
                getAllowedElements(e, allowed);
            }
            e = e.nextElementSibling;
        }
    }
    /**
     * Return the localNames of the elements that are allowed at this position.
     * @param {!Element} element
     * @return {!Array.<!string>}
     */
    this.getAllowedElements = function (element) {
        var e = findElement(element.localName),
            allowed = {},
            complexType;
        if (!e) {
            return Object.keys(allowed);
        }
        complexType = e.firstChild;
        while (complexType && complexType.localName !== "complexType") {
            complexType = complexType.nextSibling;
        }
        if (!complexType) {
            return Object.keys(allowed);
        }
        getAllowedElements(complexType, allowed);
        return Object.keys(allowed);
    };
    function forEachElement(element, ns, localName, f) {
        var e = element.firstElementChild;
        while (e) {
            if (e.namespaceURI === ns && e.localName === localName) {
                f(e);
            }
            e = e.nextElementSibling;
        }
    }
    function createDefaultAttributeValue(att) {
        return att ? "1" : "0";
    }
    function getMinOccurs(element) {
        return (element.hasAttribute("minOccurs"))
            ? parseInt(element.getAttribute("minOccurs"), 10) : 1;
    }
    function getMaxOccurs(element) {
        if (!element.hasAttribute("maxOccurs")) {
            return 1;
        }
        var maxOccurs = element.getAttribute("maxOccurs");
        if (maxOccurs === "unbounded") {
            return 100000;
        }
        return parseInt(maxOccurs, 10);
    }
    function addCollection(instance, coll) {
        if (coll.namespaceURI !== xsdns) {
            return;
        }
        var doc = instance.ownerDocument,
            e;
        if (coll.localName === "element") {
            if (!coll.hasAttribute("name")) {
                coll = findElement(coll.getAttribute("ref"));
            }
            e = doc.createElementNS(targetNamespace,
                    coll.getAttribute("name"));
            fillElementWithDefaults(e, coll);
            instance.appendChild(e);
        }
    }
    function addSequence(instance, sequence) {
        var minOccurs = getMinOccurs(sequence),
            i,
            e;
        for (i = 0; i < minOccurs; i += 1) {
            e = sequence.firstElementChild;
            while (e) {
                addCollection(instance, e);
                e = e.nextElementSibling;
            }
        }
    }
    function addChoice(instance, choice) {
        var minOccurs = getMinOccurs(choice),
            i,
            e;
        for (i = 0; i < minOccurs; i += 1) {
            e = choice.firstElementChild;
            if (e) {
                addCollection(instance, e);
            }
        }
    }
    function addGroup(instance, group) {
        group = findGroupCollection(group);
        if (group.localName === "sequence") {
            addSequence(instance, group);
        } else if (group.localName === "choice") {
            addChoice(instance, group);
        } else {
            throw "Not implemented";
        }
    }
    fillElementWithDefaults = function (instance, definition) {
        forEachElement(definition, xsdns, "complexType", function (type) {
            forEachElement(type, xsdns, "attribute", function (att) {
                if (att.getAttribute("use") === "required") {
                    if (att.hasAttribute("name")) {
                        instance.setAttribute(att.getAttribute("name"),
                            createDefaultAttributeValue(att));
                    }
                }
            });
            forEachElement(type, xsdns, "sequence", function (seq) {
                addSequence(instance, seq);
            });
            forEachElement(type, xsdns, "choice", function (seq) {
                addChoice(instance, seq);
            });
            forEachElement(type, xsdns, "group", function (seq) {
                addGroup(instance, seq);
            });
        });
    };
    /**
     * @param {!Document} doc
     * @param {!Element} elementDef
     * @return {!{desc:!string,range:?Range,dom:!DocumentFragment}}
     */
    function getPossibleElement(doc, elementDef) {
        runtime.assert(elementDef.localName === "element",
                "The definition is not for an element.");
        var f = doc.createDocumentFragment(),
            e = elementDef;
        if (!e.hasAttribute("name")) {
            e = findElement(e.getAttribute("ref"));
        }
        if (targetNamespace) {
            e = doc.createElementNS(targetNamespace, e.getAttribute("name"));
        } else {
            e = doc.createElement(e.getAttribute("name"));
        }
        f.appendChild(e);
        fillElementWithDefaults(e, elementDef);
        return {desc: '', range: null, dom: f};
    }
    /**
     * @param {!Document|!Element} documentNode
     * @return {!Array.<!{desc:!string,range:?Range,dom:!DocumentFragment}>}
     */
    function getPossibleDocuments(documentNode) {
        // for each xsd:element can lead to a document
        var r = [], e,
            doc = /**@type{!Document}*/(documentNode.ownerDocument || documentNode);
        e = xsd && xsd.firstElementChild;
        while (e) {
            if (e.namespaceURI === xsdns && e.localName === "element") {
                r.push(getPossibleElement(doc, e));
            }
            e = e.nextElementSibling;
        }
        return r;
    }
    /**
     * @param {!xmled.ValidationState} state
     * @return {undefined}
     */
    function validateSimpleTypeUpToNode(state) {
        if (state) {
            throw "Not implemented";
        }
    }
    /**
     * @param {!xmled.ValidationState} state
     * @return {undefined}
     */
    function validateAnyUpToNode(state) {
        var n = state.currentNode;
        while (n && n.nodeType !== 1) {
            n = n.nextSibling;
        }
        if (!n) {
            state.error = "No element was found.";
            return;
        }
        state.error = null;
        state.currentNode = n;
        if (!state.checkDone()) {
            state.currentNode = n.nextElementSibling;
        }
    }
    /**
     * @param {!Element} parent
     * @return {!Element}
     */
    function firstNonAnnotationChild(parent) {
        var e = parent.firstElementChild;
        if (e.localName === "annotation") {
            e = e.nextElementSibling;
        }
        if (!e) {
            throw "Expected another element.";
        }
        return e;
    }
    /**
     * @param {!xmled.ValidationState} state
     * @return {undefined}
     */
    function validateElementUpToNode(state) {
        var def = state.topDef(),
            n = state.currentNode;
        while (n && n.nodeType !== 1) {
            n = n.nextSibling;
        }
        if (!n) {
            state.error = "No element was found.";
            return;
        }
        state.error = null;
        state.currentNode = n;
        if (!def.hasAttribute("name")) {
            def = findElement(def.getAttribute("ref"));
        }
        if (def.getAttribute("name") !== n.localName) {
            state.error = "Unexpected element " + n.localName;
            return;
        }
        def = def.firstElementChild;
        if (def && def.localName === "annotation") {
            def = def.nextElementSibling;
        }
        if (def) {
            if (def.localName === "simpleType") {
                validateSimpleTypeUpToNode(state);
            } else {
                validateComplexTypeUpToNode(def, state);
            }
        }
        if (!state.checkDone()) {
            state.currentNode = n.nextElementSibling;
        }
    }
    /**
     * @param {!xmled.ValidationState} state
     * @return {undefined}
     */
    function validateSequenceUpToNode(state) {
        var def = state.topDef(),
            e = def.firstElementChild;
        while (e && !state.done()) {
            if (e.localName === "sequence" || e.localName === "choice"
                    || e.localName === "element" || e.localName === "any") {
                state.push(e);
                validateCollectionUpToNode(state);
                if (!e.nextElementSibling) {
                    state.checkDone();
                }
                state.pop();
            } else if (e.localName === "group") {
                state.push(findGroupCollection(e));
                validateCollectionUpToNode(state);
                if (!e.nextElementSibling) {
                    state.checkDone();
                }
                state.pop();
            } else {
                throw "Not implemented";
            }
            e = e.nextElementSibling;
        }
    }
    /**
     * @param {!xmled.ValidationState} state
     * @return {undefined}
     */
    function validateChoiceUpToNode(state) {
        var def = state.topDef(),
            e = def.firstElementChild,
            n = state.currentNode;
        while (e && !state.done()) {
            if (e.localName === "sequence" || e.localName === "choice"
                    || e.localName === "element") {
                state.push(e);
                validateCollectionUpToNode(state);
                if (!state.error) {
                    state.checkDone();
                    state.pop();
                    break;
                }
                state.currentNode = n;
                state.error = null;
                state.pop();
            } else {
                throw "Not implemented";
            }
            e = e.nextElementSibling;
        }
    }
    /**
     * @param {!xmled.ValidationState} state
     * @return {undefined}
     */
    validateCollectionUpToNode = function (state) {
        var def = state.topDef(),
            minOccurs = getMinOccurs(def),
            maxOccurs = getMaxOccurs(def),
            currentElement = null,
            lastElement,
            to;
        if (state.currentNode) {
            if (state.currentNode.nodeType === 1) {
                currentElement = /**@type{?Element}*/(state.currentNode);
            } else {
                currentElement = state.currentNode.parentNode.firstElementChild;
                state.currentNode = currentElement;
            }
        }
        to = state.topOccurrence();
        while (currentElement && to <= maxOccurs) {
            runtime.assert(to < 100, "looping");
            lastElement = currentElement;
            if (def.localName === "sequence") {
                validateSequenceUpToNode(state);
            } else if (def.localName === "choice") {
                validateChoiceUpToNode(state);
            } else if (def.localName === "element") {
                validateElementUpToNode(state);
                runtime.assert(state.currentNode !== currentElement
                    || state.error === null || state.done(),
                    "No progress after checking element.");
            } else if (def.localName === "any") {
                validateAnyUpToNode(state);
                runtime.assert(state.currentNode !== currentElement
                    || state.error === null || state.done(),
                    "No progress after checking any element.");
            } else {
                throw "Not implemented";
            }
            if (state.error) {
                if (state.topOccurrence() > minOccurs) {
                    // roll back one loop
                    state.error = null;
                    state.currentNode = lastElement;
                }
                break;
            }
            if (state.done()) {
                break;
            }
            currentElement = state.currentNode;
            state.topNextOccurrence();
            to = state.topOccurrence();
        }
        if (state.topOccurrence() < minOccurs) {
            state.error = "Not enough elements.";
        }
    };
    /**
     * @param {?Node} node
     * @return {!boolean}
     */
    function hasNonWhitespaceSiblings(node) {
        while (node) {
            if (node.nodeType === 3 && !/^[ \n\t\r]*$/.test(node.data)) {
                return true;
            }
            node = node.nextSibling;
        }
        return false;
    }
    /**
     * @param {?Node} node
     * @return {!boolean}
     */
    function hasNonWhitespaceChildren(node) {
        return node !== null && hasNonWhitespaceSiblings(node.firstChild);
    }
    function validateComplexContentUpToNode(cdef, state) {
        var e = firstNonAnnotationChild(cdef);
        if (e.localName === "restriction") {
            throw "Not implemented";
        }
        // e.localName === "extension"
        // ignore the base of the extension for now and simply treat it as
        // a complexType
        validateComplexTypeUpToNode(e, state);
    }
    /**
     * Validate state.currentNode to be of type cdef.
     * The top element in the state is of type cdef.
     * @param {!Element} cdef definition for element complexType
     * @param {!xmled.ValidationState} state
     * @return {undefined}
     */
    validateComplexTypeUpToNode = function (cdef, state) {
        var e = cdef.firstElementChild,
            node = state.currentNode,
            oldMixed = state.mixed;
//        if (e.localName === "annotation") {
//            e = e.nextElementSibling;
//        }
        if (cdef.hasAttribute("mixed")) {
            state.mixed = cdef.getAttribute("mixed") === "true";
        }
        if (!state.mixed && hasNonWhitespaceChildren(state.currentNode)) {
            state.error = "Text is not allowed here.";
            state.mixed = oldMixed;
            return;
        }
        state.topPosReset();
        while (e) {
            if (e.localName === "sequence" || e.localName === "choice") {
                state.currentNode = node.firstChild;
                state.push(e);
                validateCollectionUpToNode(state);
                state.pop();
            } else if (e.localName === "group") {
                state.currentNode = node.firstChild;
                state.push(findGroupCollection(e));
                validateCollectionUpToNode(state);
                state.pop();
            } else if (e.localName === "complexContent") {
                validateComplexContentUpToNode(e, state);
            } else if (e.localName !== "attribute" && e.localName !== "anyAttribute") {
                throw "Not implemented";
            }
            e = e.nextElementSibling;
        }
        if (!state.done()) {
            state.currentNode = node;
            state.checkDone();
        }
        state.mixed = oldMixed;
    };
    /**
     * @param {!xmled.ValidationState} state
     * @return {undefined}
     */
    function validateDocumentUpToNode(state) {
        var documentElement = state.documentNode.firstElementChild,
            localName,
            def;
        if (documentElement.namespaceURI !== targetNamespace) {
            state.error = "Invalid root element.";
            return;
        }
        localName = documentElement.localName;
        def = findRootElement(localName);
        if (!def) {
            state.error = "Invalid root element.";
            return;
        }
        state.push(def);
        state.currentNode = documentElement;
        if (state.documentNode === state.targetNode) {
            state.checkDone();
            return;
        }
        def = firstNonAnnotationChild(def);
        runtime.assert(def.localName === "simpleType"
                || def.localName === "complexType", "Unexpected element");
        if (def.localName === "simpleType") {
            validateSimpleTypeUpToNode(state);
        } else {
            validateComplexTypeUpToNode(def, state);
        }
        state.pop();
    }
    /**
     * @param {!Element} element
     * @return {!number}
     */
    function getPosition(element) {
        var position = 0,
            e = element.parentNode.firstElementChild;
        while (e !== element) {
            position += 1;
            e = e.nextElementSibling;
        }
        return position;
    }
    function findCollectionDefinition(def) {
        if (def.localName === "complexContent") {
            def = def.firstElementChild.firstElementChild;
        }
        if (def.localName === "group") {
            def = findGroupCollection(def);
        }
        return def;
    }
    /**
     * @param {!xmled.ParticleSearchState} state
     * @return {undefined}
     */
    function findParticlesInSequence(state) {
        var particle = state.particle,
            def = particle.element,
            e,
            offset = 0;
        def = findCollectionDefinition(def);
        e = def.firstElementChild;
        runtime.assert(def.localName === "sequence", "Sequence expected.");
        while (e && !state.done()) {
            if (e.localName === "sequence" || e.localName === "choice"
                    || e.localName === "element" || e.localName === "any"
                    || e.localName === "group") {
                state.particle = particles.getParticle(e, offset, particle);
                findParticlesInCollection(state);
            } else {
                throw "Not implemented";
            }
            e = e.nextElementSibling;
            offset += 1;
        }
    }
    /**
     * @param {!xmled.ParticleSearchState} state
     * @return {undefined}
     */
    function findParticlesInChoice(state) {
        var particle = state.particle,
            def = particle.element,
            e,
            n = state.element,
            offset = 0;
        def = findCollectionDefinition(def);
        e = def.firstElementChild;
        runtime.assert(def.localName === "choice", "Choice expected.");
        while (e && !state.done()) {
            if (e.localName === "sequence" || e.localName === "choice"
                    || e.localName === "element" || e.localName === "any"
                    || e.localName === "group") {
                state.particle = particles.getParticle(e, offset, particle);
                findParticlesInCollection(state);
                if (!state.error) {
                    break;
                }
                state.element = n;
                state.error = null;
            } else {
                throw "Not implemented";
            }
            e = e.nextElementSibling;
            offset += 1;
        }
        if (e) {
            state.error = "No choice option was chosen.";
        }
    }
    /**
     * @param {!xmled.ParticleSearchState} state
     * @return {undefined}
     */
    function findParticlesInElement(state) {
        var particle = state.particle,
            def = particle.element,
            name,
            i;
        if (def.hasAttribute("name")) {
            name = def.getAttribute("name");
        } else {
            name = def.getAttribute("ref");
            i = name.indexOf(':');
            if (i !== -1) {
                name = name.substr(i + 1);
            }
        }
        if (state.element.localName !== name) {
            state.error = "Expected " + name + " instead of "
                + state.element.localName + ".";
        } else {
            state.particles[state.offset] = particle;
            state.offset += 1;
            state.element = state.element.nextElementSibling;
        }
console.log(def.getAttribute("name") + " " + def.getAttribute("ref"));
    }
    /**
     * @param {!xmled.ParticleSearchState} state
     * @return {undefined}
     */
    function findParticlesInAny(state) {
        state.particles[state.offset] = state.particle;
        state.offset += 1;
        state.element = state.element.nextElementSibling;
    }
    /**
     * @param {!xmled.ParticleSearchState} state
     * @return {undefined}
     */
    findParticlesInCollection = function findParticlesInCollection(state) {
        var particle = state.particle,
            def = particle.element,
            minOccurs = getMinOccurs(def),
            maxOccurs = getMaxOccurs(def),
            currentElement = state.element,
            lastElement,
            localName,
            occurrence = 1;
        localName = findCollectionDefinition(def).localName;
        console.log(localName);
        while (currentElement && occurrence <= maxOccurs) {
            runtime.assert(occurrence < 100, "looping");
            state.particle = particle;
            state.error = null;
            lastElement = currentElement;
            if (localName === "sequence") {
                findParticlesInSequence(state);
            } else if (localName === "choice") {
                findParticlesInChoice(state);
            } else if (localName === "element") {
                findParticlesInElement(state);
                runtime.assert(state.element !== currentElement
                    || state.error === null || state.done(),
                    "No progress after checking element.");
            } else if (localName === "any") {
                findParticlesInAny(state);
                runtime.assert(state.element !== currentElement
                    || state.error === null || state.done(),
                    "No progress after checking any element.");
            } else {
                throw "Not implemented";
            }
            if (state.error) {
                if (occurrence > minOccurs) {
                    // roll back one loop
                    state.error = null;
                    state.element = lastElement;
                }
                break;
            }
            if (state.done()) {
                break;
            }
            currentElement = state.element;
            occurrence += 1;
        }
        if (occurrence < minOccurs) {
            throw "Not enough elements.";
        }
    };
    /**
     * @param {!Element} type
     * @param {!xmled.ParticleSearchState} state
     * @return {undefined}
     */
    function findParticlesInExtension(type, state) {
        runtime.assert(type.localName === "extension", "Expected extension");
        var types = [],
            base = findType(type.getAttribute("base"));
        type = firstNonAnnotationChild(type);
        types.push(type);
        do {
            if (base.localName === "simpleType") {
                break;
            }
            base = firstNonAnnotationChild(base);
            if (base.localName === "simpleContent") {
                break;
            }
            if (base.localName !== "complexContent") {
                types.push(base);
                break;
            }
            base = firstNonAnnotationChild(base); // extension or restriction
            types.push(firstNonAnnotationChild(base));
            if (base.localName === "extension") {
                base = findType(type.getAttribute("base"));
            } else { // restriction
                break;
            }
        } while (base);
        // now all types are all, sequence, choice or group
        types.reverse();
        // TODO: convert types to particles 
        if (state) {
            types.reverse();
        }
    }
    /**
     * Create an array with a particles.
     * Each particle corresponds to the element at the same position in the
     * input element.
     * @param {!xmled.ParticleSearchState} state
     * @return {undefined}
     */
    function findParticles(state) {
        var def = state.particle.element,
            type;
        runtime.assert(def.localName === "element",
                "findParticles requires element.");
        // dereference the element definition
        if (def.hasAttribute("ref")) {
            def = findRootElement(def.getAttribute("ref"));
        }
        runtime.assert(def !== null,
                "findParticles requires an element definition.");
        // find the type
        if (def.hasAttribute("type")) {
            type = findType(def.getAttribute("type"));
        } else {
            type = firstNonAnnotationChild(def);
        }
        // if the element is simpleType, no child elements are allowed
        if (def.localName === "simpleType") {
            if (state.element !== null) {
                throw "Element of simpleType may not contain elements.";
            }
            return;
        }
        runtime.assert(type.localName === "complexType",
                 "Expected a complexType.");
        // find the collection element of this complex type
        type = firstNonAnnotationChild(type);
        // if the type is simpleContent, no child elements are allowed
        if (type.localName === "simpleContent") {
            if (state.element !== null) {
                throw "Element of simpleType may not contain elements.";
            }
            return;
        }
        // type is now 'complexContent', 'all', 'sequence', 'choice' or 'group'
        if (type.localName === "complexContent") {
            type = firstNonAnnotationChild(type);
            if (type.localName === "restriction") {
                type = firstNonAnnotationChild(type);
            } else { // type.localName === "extension"
                findParticlesInExtension(type, state);
                return;
            }
        }
        // type is now 'all', 'sequence', 'choice' or 'group'
        state.particle = particles.getParticle(type, 0, state.particle);
        findParticlesInCollection(state);
        console.log(state.error);
    }
    /**
     * @param {!Element} element
     * @return {!xmled.Particle}
     */
    function getRootParticle(element) {
        var def = findRootElement(element.localName);
        if (!def) {
            throw "No definition for " + element.localName;
        }
        return particles.getParticle(def);
    }
    /**
     * @param {!Element} documentElement
     * @param {!Element} element
     * @return {!Array.<!Array.<!xmled.Particle>>}
     */
    function findAllParticles(documentElement, element) {
        var parents = [element],
            parentParticle,
            e = element,
            ps = [],
            state,
            i;
        while (e && documentElement !== e) {
            e = /**@type{!Element}*/(e.parentNode);
            parents.push(e);
        }
        parents.reverse();
        ps.length = parents.length;
        parentParticle = getRootParticle(documentElement);
        state = new xmled.ParticleSearchState(parentParticle);
        ps[0] = [parentParticle];
        e = documentElement;
        for (i = 1; i < parents.length; i += 1) {
            state.set(parentParticle, e, 0);
            findParticles(state);
            ps[i] = state.particles;
            runtime.assert(state.error === null, state.error || "");
            runtime.assert(state.done(), "Not done!");
            e = parents[i];
            parentParticle = ps[i][getPosition(e)];
        }
        return ps;
    }
    this.findAllParticles = findAllParticles;
    /**
     * @param {!xmled.ValidationState} state
     * @return {!Array.<{desc:!string,range:!Range,dom:!DocumentFragment}>}
     */
    function findAlternativeElements(state) {
        var doc = /**@type{!Document}*/(state.documentNode.ownerDocument
                || state.documentNode),
            f = doc.createDocumentFragment(),
            a = [],
            p,
            e;
        if (state.length() <= 1) {
            f.appendChild(state.currentNode.cloneNode(true));
            a.push({desc: '', range: {}, dom: f});
            return a; // there are no other options
        }
        p = state.def(state.length() - 2);
        e = p.firstElementChild;
        while (e) {
            if (e.localName === "element") {
                a.push(getPossibleElement(doc, e));
            }
            e = e.nextElementSibling;
        }
        return a;
    }
    /**
     * @param {?Node} n
     * @return {?Element}
     */
    function firstElementChild(n) {
        n = n && n.firstChild;
        var e = null;
        while (n && !e) {
            if (n.nodeType === 1) {
                e = /**@type{!Element}*/(n);
            }
            n = n.nextSibling;
        }
        return e;
    }
    /**
     * @param {!Document|!Element} documentNode
     * @param {!Element} node
     * @return {!Array.<{desc:!string,range:!Range,dom:!DocumentFragment}>}
     */
    function getPossibleNodeReplacements(documentNode, node) {
        var documentElement = firstElementChild(documentNode),
            state = new xmled.ValidationState(documentNode, node);
        if (documentElement) {
            findAllParticles(documentElement, node);
        }
        validateDocumentUpToNode(state);
        if (state.error) {
            throw state.error;
        }
        runtime.assert(state.currentNode !== null, "No element found.");
        runtime.assert(state.length() > 0, "No definitions in state.");
        runtime.assert(state.topDef().localName === "element",
            "Top definition must be an element definition, not "
            + state.topDef().localName + ".");
        return findAlternativeElements(state);
    }
    /**
     * @param {!Document|!Element} documentNode
     * @param {!Range} range
     * @return {!Array.<{desc:!string,range:!Range,dom:!DocumentFragment}>}
     */
    function getPossibleReplacements(documentNode, range) {
        if (range.startContainer !== range.endContainer ||
                range.endOffset - range.startOffset !== 1) {
            throw "Not implemented";
        }
        var node = range.startContainer.childNodes.item(range.startOffset),
            e;
        if (!node || node.nodeType !== 1) {
            throw "Not implemented";
        }
        e = /**@type{!Element}*/(node);
        return getPossibleNodeReplacements(documentNode, e);
    }
    /**
     * Return array of possible replacements.
     * The documentNode is the node that contains the documentElement. It does
     * not have to be a Document node.
     * The range indicates the start and end points of the range that is being
     * replaced.
     * The returned array contains a textual description, a range that contains
     * the corresponding points in the created fragment and the dom fragment
     * that can be the replacement for the input range. This range is owned by
     * the same document as the documentNode.
     *
     * @param {!Document|!Element} documentNode
     * @param {!Range=} range
     * @return {!Array.<{desc:!string,range:?Range,dom:!DocumentFragment}>}
     */
    this.getPossibleReplacements = function (documentNode, range) {
        var r;
        if (!range || (range.startContainer === documentNode
                && range.startOffset === 0 && range.endOffset === 1
                && range.endContainer === documentNode)) {
            r = getPossibleDocuments(documentNode);
        } else if (!range.collapsed) {
            r = getPossibleReplacements(documentNode, range);
        } else {
            throw "Not implemented";
        }
        return r;
    };
    function init() {
        runtime.loadXML(grammarurl, function (err, dom) {
            if (dom) {
                err = err || checker.check(dom);
            }
            if (err || !dom) {
                error = err;
                modelState = xmled.ValidationModel.State.ERROR;
                return onready && onready(error);
            }
            modelState = xmled.ValidationModel.State.READY;
            xsd = dom.documentElement;
            if (xsd.hasAttribute("targetNamespace")) {
                targetNamespace = xsd.getAttribute("targetNamespace");
            }
            return onready && onready(null);
        });
    }
    init();
};
/**
 * @enum {number}
 */
xmled.ValidationModel.State = {
    LOADING: 1,
    ERROR:   2,
    READY:   3
};
(function () {
    "use strict";
    return xmled.ValidationModel;
}());