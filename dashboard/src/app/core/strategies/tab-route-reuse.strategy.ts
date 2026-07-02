import { RouteReuseStrategy, DetachedRouteHandle, ActivatedRouteSnapshot } from '@angular/router';

export class TabRouteReuseStrategy implements RouteReuseStrategy {
  public static handlers: { [key: string]: DetachedRouteHandle } = {};

  // Helper to get full URL from route snapshot
  private getFullUrl(route: ActivatedRouteSnapshot): string {
    // We only care about the URL path, not query params for the handle key
    return route.pathFromRoot
      .map(v => v.url.map(segment => segment.path).join('/'))
      .filter(s => s)
      .join('/');
  }

  // Determines if this route should be detached to be reused later
  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    const url = this.getFullUrl(route);
    // Don't detach auth or root empty paths
    if (!url || url.startsWith('auth')) {
      return false;
    }
    // We can detach all main app routes
    return true;
  }

  // Stores the detached route
  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const url = this.getFullUrl(route);
    if (url && handle) {
      TabRouteReuseStrategy.handlers['/' + url] = handle;
    }
  }

  // Determines if this route should be reattached
  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const url = '/' + this.getFullUrl(route);
    return !!TabRouteReuseStrategy.handlers[url];
  }

  // Retrieves the previously stored route
  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const url = '/' + this.getFullUrl(route);
    return TabRouteReuseStrategy.handlers[url] || null;
  }

  // Determines if a route should be reused (e.g., when params change)
  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    // Default behavior: reuse route if the route config is the same
    return future.routeConfig === curr.routeConfig;
  }

  // Static method to destroy a handle when a tab is closed to free memory
  public static deleteHandle(url: string): void {
    const handle = TabRouteReuseStrategy.handlers[url];
    if (handle) {
      delete TabRouteReuseStrategy.handlers[url];
    }
  }
}
