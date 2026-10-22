# claude-mod-usage-meters

A Claude Code mod that draws two stacked usage bars above the prompt: your 5-hour session and your weekly allowance. Each bar shows the percent used (one decimal) and the time until it resets.

The fill is green below 50%, yellow to 75%, orange to 85%, and red above that.

## Install

Type this at the prompt of a terminal Claude Code session:

```
/plugin install usage-bars --marketplace bw0728/claude-mod-usage-meters
```

Answer `y` to add the marketplace, then pick a scope.

## Notes

- Needs a Claude Pro or Max subscription. With an API key there are no usage figures, so the bars stay hidden.
- Figures update when a turn ends or a window moves a whole percent, not every second.
- The code is one file: `hooks/register.tsx`.

## License

MIT. See `LICENSE`.
