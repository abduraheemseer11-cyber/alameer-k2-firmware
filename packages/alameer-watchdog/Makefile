include $(TOPDIR)/rules.mk

PKG_NAME:=alameer-watchdog
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKG_MAINTAINER:=Eng. Abdulrahim Al-Makhadhi

include $(INCLUDE_DIR)/package.mk

define Package/alameer-watchdog
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=ALAMEER lightweight network / Wi-Fi / memory watchdog
  DEPENDS:=+jsonfilter +uci
  PKGARCH:=all
endef

define Package/alameer-watchdog/description
  Small shell watchdog for 64 MB RAM routers: link/gateway checks, Wi-Fi radio checks,
  low-memory logging, rate-limited recovery. Reboot is disabled by default.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef
define Build/Configure
endef
define Build/Compile
endef

define Package/alameer-watchdog/install
	$(INSTALL_DIR) $(1)/usr/sbin $(1)/etc/init.d
	$(INSTALL_BIN) ./files/alameer-watchdog.sh $(1)/usr/sbin/alameer-watchdog
	$(INSTALL_BIN) ./files/alameer-watchdog.init $(1)/etc/init.d/alameer-watchdog
endef

$(eval $(call BuildPackage,alameer-watchdog))
