import { lazy, type LazyExoticComponent } from "react";

type AnyComponent = Parameters<typeof lazy>[0] extends () => Promise<{ default: infer T }>
  ? T
  : never;

type PreloadableLazy<T extends AnyComponent> = LazyExoticComponent<T> & {
  preload: () => Promise<{ default: T }>;
};

export function lazyNamed<TModule, TName extends keyof TModule>(
  loadModule: () => Promise<TModule>,
  exportName: TName,
): PreloadableLazy<Extract<TModule[TName], AnyComponent>> {
  const loadComponent = async () => {
    const module = await loadModule();
    const component = module[exportName];

    if (!component) {
      throw new Error(`Missing lazy export: ${String(exportName)}`);
    }

    return { default: component as Extract<TModule[TName], AnyComponent> };
  };

  return Object.assign(lazy(loadComponent), { preload: loadComponent });
}
