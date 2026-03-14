import { Injectable, computed, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { formatAppError } from './error-format';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private readonly swPush = inject(SwPush);
  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly hasNotificationApi =
    typeof window !== 'undefined' && typeof Notification !== 'undefined';
  private readonly hasServiceWorkerApi =
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  private readonly hasPushManagerApi =
    typeof window !== 'undefined' && 'PushManager' in window;
  private readonly hasVapidKey = Boolean(environment.pushVapidPublicKey);
  private readonly browserSupported =
    this.hasNotificationApi && this.hasServiceWorkerApi && this.hasPushManagerApi;

  readonly busy = signal(false);
  readonly subscribed = signal(false);
  readonly permission = signal<NotificationPermission | 'unsupported'>(
    this.browserSupported ? Notification.permission : 'unsupported'
  );
  readonly lastError = signal<string | null>(null);
  readonly supported = computed(() =>
    this.browserSupported && this.swPush.isEnabled && this.hasVapidKey
  );
  readonly diagnostics = computed(() => [
    {
      label: 'Notification API',
      ok: this.hasNotificationApi
    },
    {
      label: 'Service Worker API',
      ok: this.hasServiceWorkerApi
    },
    {
      label: 'PushManager API',
      ok: this.hasPushManagerApi
    },
    {
      label: 'Angular Service Worker aktiv',
      ok: this.swPush.isEnabled
    },
    {
      label: 'VAPID Public Key gesetzt',
      ok: this.hasVapidKey
    }
  ]);
  readonly unavailableReason = computed(() => {
    const failingCheck = this.diagnostics().find(check => !check.ok);
    if (!failingCheck) {
      return null;
    }

    switch (failingCheck.label) {
      case 'Notification API':
        return 'Der Browser stellt die Benachrichtigungs-API hier nicht bereit.';
      case 'Service Worker API':
        return 'Service Worker sind in diesem Browser-Kontext nicht verfügbar.';
      case 'PushManager API':
        return 'PushManager fehlt. Dieser Browser unterstützt Web Push hier nicht sauber.';
      case 'Angular Service Worker aktiv':
        return 'Der Angular Service Worker ist auf dieser Live-Seite nicht aktiv.';
      case 'VAPID Public Key gesetzt':
        return 'Im Frontend fehlt der VAPID Public Key.';
      default:
        return 'Push ist im aktuellen Browser-Kontext nicht verfügbar.';
    }
  });
  readonly statusLabel = computed(() => {
    if (!this.supported()) {
      return 'Push ist auf diesem Gerät oder in dieser App-Version gerade nicht verfügbar.';
    }
    if (this.permission() === 'denied') {
      return 'Benachrichtigungen wurden im Browser blockiert.';
    }
    if (this.subscribed()) {
      return 'Push-Benachrichtigungen sind aktiv.';
    }
    return 'Erhalte kurze Hinweise, wenn jemand ein Ziel teilt oder im Gym war.';
  });

  async refreshStatus(): Promise<void> {
    this.lastError.set(null);
    this.permission.set(this.browserSupported ? Notification.permission : 'unsupported');

    if (!this.supported() || !this.authService.user()) {
      this.subscribed.set(false);
      return;
    }

    const subscription = await this.getBrowserSubscription();
    this.subscribed.set(Boolean(subscription));
    if (subscription) {
      await this.persistSubscription(subscription);
    }
  }

  async enable(): Promise<void> {
    const user = this.authService.user();
    if (!user || !this.supported()) {
      return;
    }

    this.busy.set(true);
    this.lastError.set(null);

    try {
      const subscription = await this.swPush.requestSubscription({
        serverPublicKey: environment.pushVapidPublicKey
      });

      await this.persistSubscription(subscription);

      this.permission.set(Notification.permission);
      this.subscribed.set(true);
    } catch (error: unknown) {
      this.permission.set(this.browserSupported ? Notification.permission : 'unsupported');
      this.lastError.set(formatAppError(error, 'Push konnte nicht aktiviert werden'));
    } finally {
      this.busy.set(false);
    }
  }

  async disable(): Promise<void> {
    const user = this.authService.user();
    if (!user || !this.supported()) {
      return;
    }

    this.busy.set(true);
    this.lastError.set(null);

    try {
      const subscription = await this.getBrowserSubscription();
      if (subscription?.endpoint) {
        const { error } = await this.supabaseService.client
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);

        if (error) {
          throw error;
        }

        await subscription.unsubscribe();
      }

      this.subscribed.set(false);
    } catch (error: unknown) {
      this.lastError.set(formatAppError(error, 'Push konnte nicht deaktiviert werden'));
    } finally {
      this.busy.set(false);
    }
  }

  async sendTestNotification(): Promise<void> {
    if (!this.supported() || !this.subscribed()) {
      return;
    }

    this.busy.set(true);
    this.lastError.set(null);

    try {
      const { error } = await this.supabaseService.client.functions.invoke('send-push-notification', {
        body: { kind: 'test' }
      });

      if (error) {
        throw error;
      }
    } catch (error: unknown) {
      this.lastError.set(await this.formatFunctionError(error, 'Test-Push konnte nicht gesendet werden'));
    } finally {
      this.busy.set(false);
    }
  }

  private async getBrowserSubscription(): Promise<PushSubscription | null> {
    if (!this.browserSupported) {
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
  }

  private async persistSubscription(subscription: PushSubscription): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    const payload = subscription.toJSON();
    const p256dh = payload.keys?.['p256dh'];
    const auth = payload.keys?.['auth'];
    if (!payload.endpoint || !p256dh || !auth) {
      throw new Error('Push-Subscription ist unvollständig.');
    }

    const { error } = await this.supabaseService.client
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint: payload.endpoint,
          p256dh,
          auth,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'endpoint' }
      );

    if (error) {
      throw error;
    }
  }

  private async formatFunctionError(error: unknown, context: string): Promise<string> {
    const functionMessage = await this.readFunctionErrorMessage(error);
    if (functionMessage) {
      return `${context}\n${functionMessage}`;
    }

    return formatAppError(error, context);
  }

  private async readFunctionErrorMessage(error: unknown): Promise<string | null> {
    if (!this.isFunctionsHttpError(error)) {
      return null;
    }

    try {
      const response = error.context;
      const payload = await response.json();
      if (!payload || typeof payload !== 'object') {
        return null;
      }

      const message = this.firstString(payload, ['error', 'message', 'details']);
      if (message) {
        return message;
      }
    } catch {
      return null;
    }

    return null;
  }

  private isFunctionsHttpError(error: unknown): error is { context: Response; name?: string } {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const candidate = error as { context?: unknown; name?: unknown };
    return candidate.context instanceof Response || candidate.name === 'FunctionsHttpError';
  }

  private firstString(payload: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }
}
