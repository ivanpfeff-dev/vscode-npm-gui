/**
 * The xml element
 */
export interface Element {
    /**
    * The name of element
    */
    name: string;
    /**
    * The type of element
    */
    type: string;
    /**
    * The attributes of element
    */
    attributes?: any;
    /**
    * The children elements
    */
    elements: Element[];
}


/**
 * The item group element
 */
export interface ItemGroup {
    /**
     * The root xml
     */
    rootElement: Element;
    /**
     * The index of ItemGroup tag
     */
    itemGroupIndex: number;
    /**
     * The root elemet is <Project Sdk="Microsoft...">
     */
    projectElement: Element;
}