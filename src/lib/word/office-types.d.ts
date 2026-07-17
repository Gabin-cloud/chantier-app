declare namespace Word {
  enum InsertLocation {
    Replace = "Replace",
    Start = "Start",
    End = "End",
    Before = "Before",
    After = "After",
  }

  interface SearchOptions {
    matchCase?: boolean;
    matchWholeWord?: boolean;
    matchWildcards?: boolean;
  }

  interface Range {
    insertText(text: string, insertLocation: InsertLocation | string): void;
  }

  interface RangeCollection {
    items: Range[];
    load(propertyNames?: string): void;
  }

  interface Body {
    search(searchText: string, searchOptions?: SearchOptions): RangeCollection;
  }

  type Selection = Range;

  interface Document {
    body: Body;
    getSelection(): Selection;
  }

  interface RequestContext {
    document: Document;
    sync(): Promise<void>;
  }

  function run<T>(
    batch: (context: RequestContext) => Promise<T>
  ): Promise<T>;
}
