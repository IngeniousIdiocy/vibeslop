export interface IframePolicyOptions {
  allowScripts?: boolean;
  allowSameOrigin?: boolean;
  allowPopups?: boolean;
  allowedProtocols?: string[];
  blockedHosts?: string[];
}

export interface IframePolicy {
  getSandboxFlags(): string[];
  isUrlAllowed(url: string): boolean;
  buildAttributes(url: string): Record<string, string>;
}

const DEFAULT_ALLOWED_PROTOCOLS = ['http', 'https'];

function normalizeHost(host: string): string {
  return host.toLowerCase();
}

export function createIframePolicy(options: IframePolicyOptions = {}): IframePolicy {
  const sandboxFlags = ['allow-forms'];
  if (options.allowScripts) {
    sandboxFlags.push('allow-scripts');
  }
  if (options.allowSameOrigin) {
    sandboxFlags.push('allow-same-origin');
  }
  if (options.allowPopups) {
    sandboxFlags.push('allow-popups');
  }

  const allowedProtocols = options.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;
  const blockedHosts = new Set((options.blockedHosts ?? []).map(normalizeHost));

  function isUrlAllowed(target: string): boolean {
    try {
      const parsed = new URL(target);
      const protocol = parsed.protocol.replace(/:$/, '').toLowerCase();
      if (!allowedProtocols.includes(protocol)) {
        return false;
      }

      if (blockedHosts.has(normalizeHost(parsed.host))) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  return {
    getSandboxFlags() {
      return [...sandboxFlags];
    },
    isUrlAllowed(url) {
      return isUrlAllowed(url);
    },
    buildAttributes(url) {
      return {
        sandbox: sandboxFlags.join(' '),
        src: isUrlAllowed(url) ? url : 'about:blank',
        referrerpolicy: 'strict-origin-when-cross-origin',
      };
    },
  };
}
