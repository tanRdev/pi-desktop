// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  MarkdownTable,
  MarkdownTbody,
  MarkdownTd,
  MarkdownTh,
  MarkdownThead,
  MarkdownTr,
  markdownTableComponents,
} from "./markdown-table";

describe("MarkdownTable components", () => {
  afterEach(() => {
    cleanup();
  });

  it("MarkdownTable wraps in overflow-x-auto container", () => {
    const { container } = render(
      <MarkdownTable>
        <tbody />
      </MarkdownTable>,
    );
    const wrapper = container.querySelector(".overflow-x-auto");
    expect(wrapper).not.toBeNull();
    const table = container.querySelector("table");
    expect(table?.className).toContain("border-collapse");
  });

  it("MarkdownThead has sticky class", () => {
    const { container } = render(
      <MarkdownThead>
        <tr />
      </MarkdownThead>,
    );
    const thead = container.querySelector("thead");
    expect(thead?.className).toContain("sticky");
  });

  it("MarkdownTbody has divide-y class", () => {
    const { container } = render(
      <MarkdownTbody>
        <tr />
      </MarkdownTbody>,
    );
    const tbody = container.querySelector("tbody");
    expect(tbody?.className).toContain("divide-y");
  });

  it("MarkdownTr has even row stripe class", () => {
    const { container } = render(
      <MarkdownTr>
        <td>cell</td>
      </MarkdownTr>,
    );
    const tr = container.querySelector("tr");
    expect(tr?.className).toContain("even:bg-white/[0.02]");
  });

  it("MarkdownTh has px-3 py-2 padding", () => {
    const { container } = render(<MarkdownTh>header</MarkdownTh>);
    const th = container.querySelector("th");
    expect(th?.className).toContain("px-3");
    expect(th?.className).toContain("py-2");
  });

  it("MarkdownTd has px-3 py-2 padding", () => {
    const { container } = render(<MarkdownTd>data</MarkdownTd>);
    const td = container.querySelector("td");
    expect(td?.className).toContain("px-3");
    expect(td?.className).toContain("py-2");
  });

  it("markdownTableComponents exports all table keys", () => {
    expect(markdownTableComponents.table).toBe(MarkdownTable);
    expect(markdownTableComponents.thead).toBe(MarkdownThead);
    expect(markdownTableComponents.tbody).toBe(MarkdownTbody);
    expect(markdownTableComponents.tr).toBe(MarkdownTr);
    expect(markdownTableComponents.th).toBe(MarkdownTh);
    expect(markdownTableComponents.td).toBe(MarkdownTd);
  });
});
