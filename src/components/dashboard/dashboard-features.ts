import { LineChart, RefreshCw, Target, type LucideIcon } from "lucide-react";

/**
 * Static value-prop cards shown on the no-plan welcome dashboard (mirrors the
 * `dashboard_og_lny` design's bento grid). Each entry pairs a lucide icon with
 * the `Dashboard` i18n keys for its title and body. Kept out of the grid
 * component (convention rule 9) so the copy/order is data, testable in isolation.
 */
const DASHBOARD_FEATURES: readonly DashboardFeature[] = [
  { Icon: Target, bodyKey: "featurePrecisionBody", titleKey: "featurePrecisionTitle" },
  { Icon: RefreshCw, bodyKey: "featureAdaptationBody", titleKey: "featureAdaptationTitle" },
  { Icon: LineChart, bodyKey: "featureTrackingBody", titleKey: "featureTrackingTitle" },
];

interface DashboardFeature {
  Icon: LucideIcon;
  bodyKey: string;
  titleKey: string;
}

export { type DashboardFeature };
export default DASHBOARD_FEATURES;
