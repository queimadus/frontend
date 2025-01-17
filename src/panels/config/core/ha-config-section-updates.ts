import type { ActionDetail } from "@material/mwc-list";
import "@material/mwc-list/mwc-list-item";
import { mdiDotsVertical, mdiRefresh } from "@mdi/js";
import { HassEntities } from "home-assistant-js-websocket";
import { css, html, LitElement, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators";
import memoizeOne from "memoize-one";
import { isComponentLoaded } from "../../../common/config/is_component_loaded";
import "../../../components/ha-alert";
import "../../../components/ha-bar";
import "../../../components/ha-button-menu";
import "../../../components/ha-card";
import "../../../components/ha-metric";
import { extractApiErrorMessage } from "../../../data/hassio/common";
import {
  fetchHassioSupervisorInfo,
  HassioSupervisorInfo,
  reloadSupervisor,
  setSupervisorOption,
  SupervisorOptions,
} from "../../../data/hassio/supervisor";
import {
  checkForEntityUpdates,
  filterUpdateEntitiesWithInstall,
} from "../../../data/update";
import {
  showAlertDialog,
  showConfirmationDialog,
} from "../../../dialogs/generic/show-dialog-box";
import "../../../layouts/hass-subpage";
import type { HomeAssistant } from "../../../types";
import "../dashboard/ha-config-updates";

@customElement("ha-config-section-updates")
class HaConfigSectionUpdates extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ type: Boolean }) public narrow!: boolean;

  @state() private _showSkipped = false;

  @state() private _supervisorInfo?: HassioSupervisorInfo;

  protected firstUpdated(changedProps) {
    super.firstUpdated(changedProps);

    if (isComponentLoaded(this.hass, "hassio")) {
      fetchHassioSupervisorInfo(this.hass).then((data) => {
        this._supervisorInfo = data;
      });
    }
  }

  protected render(): TemplateResult {
    const canInstallUpdates = this._filterUpdateEntitiesWithInstall(
      this.hass.states,
      this._showSkipped
    );

    return html`
      <hass-subpage
        back-path="/config/system"
        .hass=${this.hass}
        .narrow=${this.narrow}
        .header=${this.hass.localize("ui.panel.config.updates.caption")}
      >
        <div slot="toolbar-icon">
          <ha-icon-button
            .label=${this.hass.localize(
              "ui.panel.config.updates.check_updates"
            )}
            .path=${mdiRefresh}
            @click=${this._checkUpdates}
          ></ha-icon-button>
          <ha-button-menu corner="BOTTOM_START" @action=${this._handleAction}>
            <ha-icon-button
              slot="trigger"
              .label=${this.hass.localize("ui.common.menu")}
              .path=${mdiDotsVertical}
            ></ha-icon-button>
            <mwc-list-item id="skipped">
              ${this._showSkipped
                ? this.hass.localize("ui.panel.config.updates.hide_skipped")
                : this.hass.localize("ui.panel.config.updates.show_skipped")}
            </mwc-list-item>
            ${this._supervisorInfo?.channel !== "dev"
              ? html`
                  <mwc-list-item id="beta">
                    ${this._supervisorInfo?.channel === "stable"
                      ? this.hass.localize("ui.panel.config.updates.join_beta")
                      : this.hass.localize(
                          "ui.panel.config.updates.leave_beta"
                        )}
                  </mwc-list-item>
                `
              : ""}
          </ha-button-menu>
        </div>
        <div class="content">
          <ha-card outlined>
            <div class="card-content">
              ${canInstallUpdates.length
                ? html`
                    <ha-config-updates
                      .hass=${this.hass}
                      .narrow=${this.narrow}
                      .updateEntities=${canInstallUpdates}
                      showAll
                    ></ha-config-updates>
                  `
                : html`
                    ${this.hass.localize("ui.panel.config.updates.no_updates")}
                  `}
            </div>
          </ha-card>
        </div>
      </hass-subpage>
    `;
  }

  private _handleAction(ev: CustomEvent<ActionDetail>) {
    switch (ev.detail.index) {
      case 0:
        this._showSkipped = !this._showSkipped;
        break;
      case 1:
        this._toggleBeta();
        break;
    }
  }

  private async _toggleBeta(): Promise<void> {
    if (this._supervisorInfo!.channel === "stable") {
      const confirmed = await showConfirmationDialog(this, {
        title: this.hass.localize("ui.dialogs.join_beta_channel.title"),
        text: html`${this.hass.localize("ui.dialogs.join_beta_channel.warning")}
          <br />
          <b> ${this.hass.localize("ui.dialogs.join_beta_channel.backup")} </b>
          <br /><br />
          ${this.hass.localize("ui.dialogs.join_beta_channel.release_items")}
          <ul>
            <li>Home Assistant Core</li>
            <li>Home Assistant Supervisor</li>
            <li>Home Assistant Operating System</li>
          </ul>
          <br />
          ${this.hass.localize("ui.dialogs.join_beta_channel.confirm")}`,
        confirmText: this.hass.localize("ui.panel.config.updates.join_beta"),
        dismissText: this.hass.localize("ui.common.cancel"),
      });

      if (!confirmed) {
        return;
      }
    }

    try {
      const data: Partial<SupervisorOptions> = {
        channel: this._supervisorInfo!.channel === "stable" ? "beta" : "stable",
      };
      await setSupervisorOption(this.hass, data);
      await reloadSupervisor(this.hass);
    } catch (err: any) {
      showAlertDialog(this, {
        text: extractApiErrorMessage(err),
      });
    }
  }

  private async _checkUpdates(): Promise<void> {
    checkForEntityUpdates(this, this.hass);
  }

  private _filterUpdateEntitiesWithInstall = memoizeOne(
    (entities: HassEntities, showSkipped: boolean) =>
      filterUpdateEntitiesWithInstall(entities, showSkipped)
  );

  static styles = css`
    .content {
      padding: 28px 20px 0;
      max-width: 1040px;
      margin: 0 auto;
    }
    ha-card {
      max-width: 600px;
      margin: 0 auto;
      height: 100%;
      justify-content: space-between;
      flex-direction: column;
      display: flex;
      margin-bottom: max(24px, env(safe-area-inset-bottom));
    }

    .card-content {
      display: flex;
      justify-content: space-between;
      flex-direction: column;
      padding: 16px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-config-section-updates": HaConfigSectionUpdates;
  }
}
