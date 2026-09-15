/**
 * ShopScreen.tsx
 *
 * Spiritual products shop powered by Firestore.
 * Products + affiliate links are managed entirely from Firebase Console.
 *
 * Features:
 *   - Real-time Firestore sync (products update live)
 *   - Category filter tabs (derived from your data)
 *   - Featured products horizontal scroll row
 *   - Card grid: image, name, price, badge, buy button
 *   - Tapping "Buy" opens affiliate link via Linking.openURL
 *   - Pull-to-refresh
 *   - Skeleton loading state
 *   - Bilingual (Hindi + English) throughout
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Linking,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { GradientBackground } from "../../components/GradientBackground";
import { spacing, typography, useTheme, ThemeColors } from "../../theme";
import { Ionicons } from "@expo/vector-icons";
import {
  useProducts,
  getCategoryLabel,
  type Product,
} from "../../services/useProducts";

const { width: SW } = Dimensions.get("window");
const CARD_WIDTH = (SW - spacing.md * 2 - spacing.sm) / 2;
const FEATURED_WIDTH = SW * 0.7;

// ─────────────────────────────────────────────
// SHARED THEME-AWARE STYLES
// (built once per theme change, shared by every atom in this file)
// ─────────────────────────────────────────────
function useShopStyles() {
  const { colors, spacing, typography } = useTheme();
  const card = useMemo(
    () => makeCardStyles(colors, spacing, typography),
    [colors, spacing, typography],
  );
  const feat = useMemo(
    () => makeFeatStyles(colors, spacing, typography),
    [colors, spacing, typography],
  );
  const sk = useMemo(
    () => makeSkStyles(colors, spacing, typography),
    [colors, spacing, typography],
  );
  const tab = useMemo(
    () => makeTabStyles(colors, spacing, typography),
    [colors, spacing, typography],
  );
  const st = useMemo(
    () => makeStStyles(colors, spacing, typography),
    [colors, spacing, typography],
  );
  return { colors, spacing, typography, card, feat, sk, tab, st };
}

// ─────────────────────────────────────────────
// OPEN AFFILIATE LINK
// ─────────────────────────────────────────────
async function openAffiliateLink(
  url: string,
  productName: string,
): Promise<void> {
  if (!url) {
    Alert.alert(
      "लिंक उपलब्ध नहीं · Link Unavailable",
      "This product link is not set yet.",
    );
    return;
  }
  try {
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else Alert.alert("त्रुटि · Error", `Cannot open: ${url}`);
  } catch {
    Alert.alert("त्रुटि · Error", "Could not open the product link.");
  }
}

// ─────────────────────────────────────────────
// BADGE CHIP
// ─────────────────────────────────────────────
const BadgeChip: React.FC<{ label: string }> = ({ label }) => {
  const { colors } = useShopStyles();
  const color =
    label === "Bestseller"
      ? "#F97316"
      : label === "New"
        ? "#22C55E"
        : label === "Sacred"
          ? "#A855F7"
          : colors.gold;

  return (
    <View
      style={[
        chip.wrap,
        { backgroundColor: color + "22", borderColor: color + "60" },
      ]}
    >
      <Text style={[chip.txt, { color }]}>{label}</Text>
    </View>
  );
};
const chip = StyleSheet.create({
  wrap: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  txt: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});

// ─────────────────────────────────────────────
// PRODUCT CARD  (grid)
// ─────────────────────────────────────────────
const ProductCard: React.FC<{ item: Product }> = ({ item }) => {
  const { colors, card } = useShopStyles();
  return (
  <View style={card.wrap}>
    {/* Image */}
    <View style={card.imgBox}>
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={card.img}
          resizeMode="cover"
        />
      ) : (
        <View style={card.imgPlaceholder}>
          <Text style={{ fontSize: 32 }}>🛍️</Text>
        </View>
      )}
      {item.badge ? (
        <View style={card.badgePos}>
          <BadgeChip label={item.badge} />
        </View>
      ) : null}
    </View>

    {/* Info */}
    <View style={card.info}>
      <Text style={card.nameEn} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={card.nameHi} numberOfLines={1}>
        {item.nameHi}
      </Text>
      {item.description ? (
        <Text style={card.desc} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      <View style={card.bottom}>
        <Text style={card.price}>{item.price}</Text>
        <TouchableOpacity
          style={card.buyBtn}
          onPress={() => openAffiliateLink(item.affiliateUrl, item.name)}
          activeOpacity={0.8}
        >
          <Ionicons name="cart-outline" size={14} color={colors.bgSecondary} />
          <Text style={card.buyTxt}>Buy</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
  );
};

function makeCardStyles(
  colors: ThemeColors,
  spacing: Record<string, number>,
  typography: any,
) {
  return StyleSheet.create({
  wrap: {
    width: CARD_WIDTH,
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  imgBox: { width: "100%", height: CARD_WIDTH * 0.85, position: "relative" },
  img: { width: "100%", height: "100%" },
  imgPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.gold + "10",
    alignItems: "center",
    justifyContent: "center",
  },
  badgePos: { position: "absolute", top: 6, left: 6 },
  info: { padding: spacing.sm, gap: 3 },
  nameEn: {
    fontSize: typography.fontSize.sm,
    fontWeight: "700",
    color: colors.textPrimary,
    lineHeight: 18,
  },
  nameHi: { fontSize: 10, color: colors.gold + "BB" },
  desc: { fontSize: 10, color: colors.textMuted, lineHeight: 14, marginTop: 2 },
  bottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  price: {
    fontSize: typography.fontSize.md,
    color: colors.gold,
    fontWeight: "800",
  },
  buyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  buyTxt: { fontSize: 11, color: colors.bgSecondary, fontWeight: "700" },
  });
}

// ─────────────────────────────────────────────
// FEATURED CARD  (horizontal scroll)
// ─────────────────────────────────────────────
const FeaturedCard: React.FC<{ item: Product }> = ({ item }) => {
  const { feat } = useShopStyles();
  return (
  <TouchableOpacity
    style={feat.wrap}
    onPress={() => openAffiliateLink(item.affiliateUrl, item.name)}
    activeOpacity={0.88}
  >
    {item.imageUrl ? (
      <Image
        source={{ uri: item.imageUrl }}
        style={feat.img}
        resizeMode="cover"
      />
    ) : (
      <View style={[feat.img, feat.imgPlaceholder]}>
        <Text style={{ fontSize: 44 }}>🪔</Text>
      </View>
    )}
    {/* Gradient overlay */}
    <View style={feat.overlay} />
    <View style={feat.content}>
      {item.badge ? <BadgeChip label={item.badge} /> : null}
      <Text style={feat.nameEn} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={feat.nameHi} numberOfLines={1}>
        {item.nameHi}
      </Text>
      <View style={feat.row}>
        <Text style={feat.price}>{item.price}</Text>
        <View style={feat.buyPill}>
          <Text style={feat.buyTxt}>Shop Now →</Text>
        </View>
      </View>
    </View>
  </TouchableOpacity>
  );
};

function makeFeatStyles(
  colors: ThemeColors,
  spacing: Record<string, number>,
  typography: any,
) {
  return StyleSheet.create({
  wrap: {
    width: FEATURED_WIDTH,
    height: 170,
    borderRadius: 16,
    overflow: "hidden",
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gold + "30",
  },
  img: { ...StyleSheet.absoluteFillObject },
  imgPlaceholder: {
    backgroundColor: colors.gold + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,8,5,0.55)",
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    padding: spacing.md,
    justifyContent: "flex-end",
    gap: 4,
  },
  nameEn: {
    fontSize: typography.fontSize.md,
    fontWeight: "700",
    color: "#fff",
  },
  nameHi: { fontSize: 11, color: colors.gold + "CC" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  price: {
    fontSize: typography.fontSize.lg,
    color: colors.gold,
    fontWeight: "800",
  },
  buyPill: {
    backgroundColor: colors.gold,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  buyTxt: { fontSize: 11, color: colors.bgSecondary, fontWeight: "700" },
  });
}

// ─────────────────────────────────────────────
// SKELETON CARD
// ─────────────────────────────────────────────
const SkeletonCard = () => {
  const { card, sk } = useShopStyles();
  return (
  <View style={[card.wrap, sk.wrap]}>
    <View style={[card.imgBox, sk.block]} />
    <View style={card.info}>
      <View style={[sk.line, { width: "80%", height: 12 }]} />
      <View style={[sk.line, { width: "50%", height: 9, marginTop: 4 }]} />
      <View style={[sk.line, { width: "40%", height: 16, marginTop: 8 }]} />
    </View>
  </View>
  );
};
function makeSkStyles(
  colors: ThemeColors,
  spacing: Record<string, number>,
  typography: any,
) {
  return StyleSheet.create({
  wrap: { opacity: 0.5 },
  block: { backgroundColor: colors.cardBorder },
  line: { backgroundColor: colors.cardBorder, borderRadius: 4 },
  });
}

// ─────────────────────────────────────────────
// CATEGORY TAB
// ─────────────────────────────────────────────
const CategoryTab: React.FC<{
  cat: string;
  active: boolean;
  onPress: () => void;
}> = ({ cat, active, onPress }) => {
  const { tab } = useShopStyles();
  const label = getCategoryLabel(cat);
  return (
    <TouchableOpacity
      style={[tab.btn, active && tab.btnActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={tab.emoji}>{label.emoji}</Text>
      <Text style={[tab.en, active && tab.enActive]}>{label.en}</Text>
      <Text style={[tab.hi, active && tab.hiActive]}>{label.hi}</Text>
    </TouchableOpacity>
  );
};
function makeTabStyles(
  colors: ThemeColors,
  spacing: Record<string, number>,
  typography: any,
) {
  return StyleSheet.create({
  btn: {
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.cardBg,
    marginRight: 8,
    gap: 1,
  },
  btnActive: { backgroundColor: colors.gold + "20", borderColor: colors.gold },
  emoji: { fontSize: 16 },
  en: { fontSize: 10, color: colors.textMuted, fontWeight: "600" },
  enActive: { color: colors.gold },
  hi: { fontSize: 9, color: colors.textMuted + "88" },
  hiActive: { color: colors.gold + "AA" },
  });
}

// ─────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────
const EmptyState = () => {
  const { st } = useShopStyles();
  return (
  <View style={st.emptyBox}>
    <Text style={{ fontSize: 48 }}>🛍️</Text>
    <Text style={st.emptyTitle}>No Products Yet</Text>
    <Text style={st.emptyHi}>अभी कोई उत्पाद नहीं है</Text>
    <Text style={st.emptySub}>
      Add products from your Firebase Console to display them here.
    </Text>
  </View>
  );
};

// ─────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────
export default function ShopScreen() {
  const { colors, st } = useShopStyles();
  const { products, featured, categories, loading, error, refresh } =
    useProducts();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [refresh]);

  const filtered = useMemo(
    () =>
      activeCategory === "all"
        ? products
        : products.filter((p) => p.category === activeCategory),
    [products, activeCategory],
  );

  // Build pairs for grid
  const rows = useMemo(() => {
    const pairs: [Product, Product | null][] = [];
    for (let i = 0; i < filtered.length; i += 2) {
      pairs.push([filtered[i], filtered[i + 1] ?? null]);
    }
    return pairs;
  }, [filtered]);

  return (
    <GradientBackground>
      <ScrollView
        style={st.container}
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
      >
        {/* ── HEADER ── */}
        <View style={st.header}>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle}>🛍️ दुकान · Shop</Text>
            <Text style={st.headerSub}>
              Spiritual products · आध्यात्मिक उत्पाद
            </Text>
          </View>
          <TouchableOpacity style={st.refreshBtn} onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={20} color={colors.gold} />
          </TouchableOpacity>
        </View>

        {/* ── ERROR ── */}
        {error && (
          <View style={st.errorBox}>
            <Ionicons name="warning-outline" size={18} color="#F87171" />
            <Text style={st.errorTxt}>{error}</Text>
            <TouchableOpacity onPress={refresh}>
              <Text style={st.errorRetry}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── FEATURED ── */}
        {!loading && featured.length > 0 && (
          <>
            <View style={st.sectionRow}>
              <Text style={st.sectionTitle}>⭐ Featured · विशेष</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={st.featuredList}
            >
              {featured.map((item, index) => (
                <FeaturedCard key={index + "featured"} item={item} />
              ))}
            </ScrollView>
          </>
        )}

        {/* ── CATEGORY TABS ── */}
        {categories.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.tabsRow}
          >
            {categories.map((cat, index) => (
              <CategoryTab
                key={index + "Category"}
                cat={cat}
                active={activeCategory === cat}
                onPress={() => setActiveCategory(cat)}
              />
            ))}
          </ScrollView>
        )}

        {/* ── SECTION TITLE ── */}
        <View style={st.sectionRow}>
          <Text style={st.sectionTitle}>
            {getCategoryLabel(activeCategory).emoji}{" "}
            {getCategoryLabel(activeCategory).en}
            {" · "}
            {getCategoryLabel(activeCategory).hi}
          </Text>
          {!loading && (
            <Text style={st.productCount}>{filtered.length} items</Text>
          )}
        </View>

        {/* ── LOADING SKELETONS ── */}
        {loading && (
          <View style={st.grid}>
            {[1, 2, 3, 4].map((i, index) => (
              <SkeletonCard key={index + "Skelton"} />
            ))}
          </View>
        )}

        {/* ── GRID ── */}
        {!loading && filtered.length === 0 && <EmptyState />}

        {!loading && rows.length > 0 && (
          <View style={st.grid}>
            {rows.map(([a, b], i) => (
              <View key={i + Math.random()} style={st.gridRow}>
                <ProductCard item={a} />
                {b ? (
                  <ProductCard item={b} />
                ) : (
                  <View style={{ width: CARD_WIDTH }} />
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── DISCLAIMER ── */}
        <View style={st.disclaimer}>
          <Ionicons
            name="information-circle-outline"
            size={13}
            color={colors.textMuted}
          />
          <Text style={st.disclaimerTxt}>
            Products may contain affiliate links. Purchasing through these links
            supports this app at no extra cost to you.
          </Text>
        </View>
      </ScrollView>
    </GradientBackground>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
function makeStStyles(
  colors: ThemeColors,
  spacing: Record<string, number>,
  typography: any,
) {
  return StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.gold,
  },
  headerSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gold + "15",
    alignItems: "center",
    justifyContent: "center",
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: "#F8717115",
    borderRadius: 10,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: "#F8717140",
  },
  errorTxt: { flex: 1, fontSize: 12, color: "#F87171" },
  errorRetry: { fontSize: 12, color: colors.gold, fontWeight: "700" },

  featuredList: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },

  tabsRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  productCount: { fontSize: 11, color: colors.textMuted },

  grid: { paddingHorizontal: spacing.md },
  gridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  emptyBox: {
    alignItems: "center",
    paddingVertical: spacing.xl * 2,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  emptyHi: { fontSize: 13, color: colors.gold },
  emptySub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },

  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  disclaimerTxt: {
    flex: 1,
    fontSize: 10,
    color: colors.textMuted,
    lineHeight: 15,
  },
  });
}
