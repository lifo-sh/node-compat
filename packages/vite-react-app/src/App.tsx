import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { stories, categories, type Story } from "stories";

function App() {
  const [selected, setSelected] = useState<number | null>(null);
  const [results, setResults] = useState<Map<number, { output: string; error?: boolean }>>(new Map());
  const [running, setRunning] = useState<Set<number>>(new Set());

  const selectedStory: Story | null = selected !== null ? stories[selected] : null;
  const result = selected !== null ? results.get(selected) : undefined;

  async function runStory(index: number) {
    const story = stories[index];
    if (story.status !== "implemented" || !story.run) return;
    setRunning((prev) => new Set(prev).add(index));
    try {
      const output = await story.run();
      setResults((prev) => new Map(prev).set(index, { output }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setResults((prev) => new Map(prev).set(index, { output: message, error: true }));
    }
    setRunning((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }

  const implementedCount = stories.filter((s) => s.status === "implemented").length;
  const totalCount = stories.length;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-border flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-border">
          <h1 className="text-sm font-bold tracking-tight">node-compat</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {implementedCount}/{totalCount} implemented
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <nav className="p-2 space-y-4">
            {categories.map((cat) => {
              const catStories = stories
                .map((s, i) => ({ ...s, globalIndex: i }))
                .filter((s) => s.category === cat.key);
              if (catStories.length === 0) return null;
              const implCount = catStories.filter((s) => s.status === "implemented").length;
              return (
                <div key={cat.key}>
                  <div className="flex items-center gap-2 mb-1 px-2 pt-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {cat.label}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-muted-foreground border-border">
                      {implCount}/{catStories.length}
                    </Badge>
                  </div>
                  <div className="space-y-px">
                    {catStories.map((story) => {
                      const isSelected = selected === story.globalIndex;
                      const hasResult = results.has(story.globalIndex);
                      const hasError = results.get(story.globalIndex)?.error;
                      const isComingSoon = story.status === "coming-soon";
                      return (
                        <button
                          key={story.globalIndex}
                          onClick={() => !isComingSoon && setSelected(story.globalIndex)}
                          className={`w-full text-left px-3 py-1.5 rounded-md text-[13px] transition-colors flex items-center gap-2 ${
                            isComingSoon
                              ? "text-muted-foreground/40 cursor-default"
                              : isSelected
                                ? "bg-accent text-accent-foreground"
                                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                          }`}
                        >
                          {isComingSoon ? (
                            <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0 border border-muted-foreground/30" />
                          ) : hasResult ? (
                            <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${hasError ? "bg-red-500" : "bg-emerald-500"}`} />
                          ) : (
                            <span className="inline-block w-1.5 h-1.5 shrink-0" />
                          )}
                          <span className="truncate">{story.name}</span>
                          {isComingSoon && (
                            <span className="ml-auto text-[10px] text-muted-foreground/40 shrink-0">soon</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Source panel */}
      <div className="w-[420px] shrink-0 border-r border-border flex flex-col">
        {selectedStory && selectedStory.status === "implemented" ? (
          <>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{selectedStory.name}</p>
                <p className="text-xs text-muted-foreground">
                  {categories.find((c) => c.key === selectedStory.category)?.description ?? selectedStory.category}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => runStory(selected!)}
                disabled={running.has(selected!)}
                className="shrink-0"
              >
                {running.has(selected!) ? "Running..." : "Run"}
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4">
                <pre className="rounded-lg bg-zinc-950 border border-zinc-800 p-4 text-[13px] font-mono leading-relaxed text-zinc-300 whitespace-pre overflow-x-auto">
                  {selectedStory.source}
                </pre>
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center px-6">
            <p className="text-sm text-muted-foreground text-center">
              {selectedStory?.status === "coming-soon"
                ? "This API is not yet implemented"
                : "Select an example from the sidebar"}
            </p>
          </div>
        )}
      </div>

      {/* Output panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Output
          </span>
          {result && (
            <Badge variant={result.error ? "destructive" : "secondary"} className="text-[10px]">
              {result.error ? "Error" : "Success"}
            </Badge>
          )}
        </div>
        <ScrollArea className="flex-1">
          {result ? (
            <div className="p-4">
              <pre
                className={`rounded-lg border p-4 text-sm font-mono leading-relaxed whitespace-pre overflow-x-auto ${
                  result.error
                    ? "bg-red-950/30 border-red-900/50 text-red-400"
                    : "bg-emerald-950/20 border-emerald-900/30 text-emerald-300"
                }`}
              >
                {result.output}
              </pre>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center h-full min-h-[200px]">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {selectedStory ? "Click Run to execute" : "Select an example to get started"}
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

export default App;
