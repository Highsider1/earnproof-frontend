/**
 * Message ownership.
 *
 * A user-facing string needs an owner: exactly one module that defines it,
 * one stable key that identifies it, and one place a translator will later
 * be handed. Strings written inline in JSX have none of those things — they
 * cannot be found, cannot be reviewed as a set, and cannot be replaced
 * without touching the component.
 *
 * `defineMessages` is the convention:
 *
 * ```ts
 * const messages = defineMessages("status", {
 *   title: "Platform status",
 *   lastChecked: "Last checked",
 * });
 *
 * <h1>{messages.title}</h1>
 * ```
 *
 * The namespace is the owner, the key is stable, and `messages.title` is a
 * whole string — never a fragment. When `NEXT_PUBLIC_PSEUDO_LOCALE=1`, every
 * value in the catalog comes back pseudo-localized, which is what makes an
 * un-owned inline string obvious on screen: it stays plain ASCII while
 * everything around it is accented and expanded.
 */

import { isPseudoLocaleEnabled } from "./locale";
import { pseudoLocalize } from "./pseudo-locale";

export type MessageCatalog = Readonly<Record<string, string>>;

export type OwnedMessages<T extends MessageCatalog> = T & {
  /** Stable, namespaced keys — what a translation system keys off. */
  readonly $keys: Readonly<Record<keyof T, string>>;
  readonly $namespace: string;
};

/**
 * Register a catalog of user-facing strings under an owning namespace.
 *
 * The returned object is frozen: a message cannot be mutated at runtime, so
 * "the string changed somewhere else" is not a failure mode this app has.
 */
export function defineMessages<T extends MessageCatalog>(
  namespace: string,
  catalog: T,
  options: { pseudo?: boolean } = {},
): OwnedMessages<T> {
  const pseudo = options.pseudo ?? isPseudoLocaleEnabled();

  const values = Object.fromEntries(
    Object.entries(catalog).map(([key, value]) => [key, pseudo ? pseudoLocalize(value) : value]),
  ) as T;

  const keys = Object.fromEntries(
    Object.keys(catalog).map((key) => [key, `${namespace}.${key}`]),
  ) as Readonly<Record<keyof T, string>>;

  return Object.freeze({ ...values, $keys: Object.freeze(keys), $namespace: namespace });
}

/**
 * Substitute `{placeholder}` values into a whole owned message.
 *
 * This is the supported way to get a value into a sentence. The alternative —
 * `` `Income ${operator} ${amount}` `` — splits one sentence into fragments
 * that a translator can never reorder, and bakes English word order into
 * code. With a placeholder the whole sentence stays one owned string and the
 * translation is free to move `{amount}` wherever its language needs it.
 *
 * A placeholder with no matching value is left in place rather than rendered
 * as `undefined`, so a missing value is visible instead of silently blank.
 */
export function formatMessage(
  template: string,
  values: Readonly<Record<string, string | number>> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
