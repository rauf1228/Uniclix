import React, { Component } from "react";
import _ from "lodash";
import UpgradeAlert from "../UpgradeAlert";
import PropTypes from "prop-types";
import getMuiTheme from "material-ui/styles/getMuiTheme";
import { Dialog, FlatButton, Menu, MenuItem, TextField } from "material-ui";
import { Grid } from "@material-ui/core";
import { Select } from "antd";
import { Tabs, Tab } from "react-draggable-tab";
import {
  getStreams,
  setRefreshRate,
  selectTab,
  positionTab,
  addTab,
  deleteTab,
  renameTab,
} from "../../requests/streams";
import StreamItems from "./StreamItems";
import StreamInitiator from "./StreamInitiator";
import Loader from "../Loader";
import Compose from "./../Compose";
import Modal from "react-modal";

const { Option } = Select;

const tabsClassNames = {
  tabWrapper: "dndWrapper",
  tabBar: "dndTabBar",
  tabBarAfter: "dndTabBarAfter",
  tab: "dndTab",
  tabTitle: "dndTabTitle",
  tabCloseIcon: "tabCloseIcon",
  tabBefore: "dndTabBefore",
  tabAfter: "dndTabAfter",
};

const tabsStyles = {
  tabWrapper: {},
  tabBar: {
    backgroundColor: "#F5F7FB",
    maxWidth: "100%",
    height: "50px",
    borderBottom: "1px #DBDBDB solid",
  },
  tab: {
    marginLeft: "0px",
    paddingLeft: "0px",
    paddingRight: "0px",
    height: "100%",
  },
  tabTitle: {},
  tabCloseIcon: {},
  tabBefore: { width: "0px" },
  tabAfter: { width: "0px" },
};

class StreamTabs extends Component {
  state = {
    tabs: [],
    tabData: [],
    badgeCount: 0,
    menuPosition: {},
    showMenu: false,
    dialogOpen: false,
    selectedTab: "tab0",
    loading: false,
    forbidden: false,
    addStream: false,
    streamMaker: localStorage.getItem("streamMaker") === "false" ? false : true,
    selectedSocial: "",
    selectedAccountId: "",
    isClosedTab: false,
    closeTab: "",
  };

  componentDidMount() {
    this.fetchStreamTabs();
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.streamMaker !== this.state.streamMaker) {
      this.setTabs(this.state.tabData, this.state.selectedTab);
      localStorage.setItem("streamMaker", this.state.streamMaker);
    }
  }

  getChildContext() {
    return { muiTheme: getMuiTheme() };
  }

  makeListeners(key) {
    return {
      //onClick: (e) => { console.log('onClick', key, e);}, // never called
      //onContextMenu: (e) => { console.log('onContextMeun', key, e); this.handleTabContextMenu(key, e) },
      onDoubleClick: (e) => {
        console.log("onDoubleClick", key, e);
        this.handleTabDoubleClick(key, e);
      },
    };
  }

  handleTabSelect(e, key, currentTabs) {
    this.setState({ selectedTab: key, tabs: currentTabs }, () => {
      selectTab(key);
    });
  }

  handleTabClose(e, key, currentTabs) {
    // console.log('tabClosed key:', key);
    this.setState({ tabs: currentTabs }, () => {
      deleteTab({ key, selectedKey: this.state.selectedTab });
    });
  }

  handleTabPositionChange(e, key, currentTabs) {
    this.setState({ tabs: currentTabs }, () => {
      positionTab(currentTabs, key);
    });
  }

  handleTabAddButtonClick(e, currentTabs) {
    // key must be unique
    const key = "newTab_" + Date.now();

    if (currentTabs.length > 9) {
      alert("You have reached the tab limit");
      return;
    }

    let newTab = (
      <Tab key={key} title="untitled" {...this.makeListeners(key)}>
        <div>
          <StreamInitiator
            selectedTab={key}
            reload={this.fetchStreamTabs}
            onChangeSocial={(val) => this.handleChangeSocial(val)}
            onChangeAccount={(val) => this.handleChangeAccount(val)}
          />
        </div>
      </Tab>
    );

    let newTabs = currentTabs.concat([newTab]);

    const data = {
      key,
      title: "untitled",
    };

    this.setState(
      {
        tabs: newTabs,
        selectedTab: key,
      },
      () => {
        addTab(data);
      }
    );
  }

  handleRefreshRateChange = (val) => {
    const refreshRate = parseInt(val);

    setRefreshRate({ key: this.state.selectedTab }, refreshRate).then(() =>
      this.fetchStreamTabs()
    );
  };

  handleTabDoubleClick(key) {
    this.setState({
      editTabKey: key,
      dialogOpen: true,
    });
  }

  handleTabContextMenu(key, e) {
    e.preventDefault();
    this.setState({
      showMenu: true,
      contextTarget: key,
      menuPosition: {
        top: `${e.pageY}px`,
        left: `${e.pageX}px`,
      },
    });
  }

  cancelContextMenu() {
    this.setState({
      showMenu: false,
      contextTarget: null,
    });
  }

  renameFromContextMenu() {
    this.setState({
      showMenu: false,
      contextTarget: null,
      editTabKey: this.state.contextTarget,
      dialogOpen: true,
    });
  }

  closeFromContextMenu() {
    let newTabs = _.filter(this.state.tabs, (t) => {
      return t.key !== this.state.contextTarget;
    });
    this.setState({
      showMenu: false,
      contextTarget: null,
      selectedTab: "tab0",
      tabs: newTabs,
    });
  }

  _onDialogSubmit() {
    const replaceFunc = _.bind((tab) => {
        if (tab.key === this.state.editTabKey) {
          return React.cloneElement(tab, { title: this.refs.input.getValue() });
        }
        return tab;
      }, this),
      newTabs = _.map(this.state.tabs, replaceFunc);
    this.setState(
      {
        tabs: newTabs,
        dialogOpen: false,
      },
      () => {
        renameTab({
          key: this.state.editTabKey,
          title: this.refs.input.getValue(),
        });
      }
    );
  }

  _onDialogCancel() {
    this.setState({
      dialogOpen: false,
    });
  }

  _onDialogShow() {
    let tab = _.find(this.state.tabs, (t) => {
      return t.key === this.state.editTabKey;
    });
    this.refs.input.setValue(tab.props.title);
  }

  shouldTabClose(e, key) {
    this.setState({
      isClosedTab: true,
      closeTab: key,
    });
  }

  handleConfirmClose() {
    let key = this.state.closeTab;
    let currentTabs = this.state.tabs;
    let tabs = currentTabs.filter((item) => item.key != key);
    if (key == this.state.selectedTab) {
      let index = currentTabs.findIndex((item) => item.key == key);
      if (index == currentTabs.length - 1) {
        this.setState({ selectedTab: currentTabs[index - 1]["key"] });
      } else {
        this.setState({ selectedTab: currentTabs[index + 1]["key"] });
      }
    }

    this.handleTabClose(null, key, tabs);
    this.setState({ isClosedTab: false });
  }

  handleAddStream = () => {
    this.setState(() => ({
      addStream: !this.state.addStream,
    }));
  };

  toggleStreamMaker = () => {
    this.setState(() => ({
      streamMaker: !this.state.streamMaker,
    }));
  };

  handleChangeSocial = (value) => {
    this.setState({ selectedSocial: value });
  };

  handleChangeAccount = (value) => {
    this.setState({ selectedAccountId: value });
  };

  setTabs = (items, selectedTab = "tab0") => {
    this.setState(() => ({
      tabs: items.map((tab) => (
        <Tab key={tab.key} title={tab.title} {...this.makeListeners(tab.key)}>
          <div>
            {tab.streams.length ? (
              <div className="easygrey-bg stream-drag-drop">
                <div className="refresh-section">
                  <Grid container>
                    <Grid item md={6}>
                      <span>Refresh every</span>
                    </Grid>
                    <Grid item md={6}>
                      <Select
                        className="monitor-smalltitle"
                        size="default"
                        value={parseInt(tab.refresh_rate)}
                        onChange={(val) => this.handleRefreshRateChange(val)}
                      >
                        <Option value={2}>
                          <span className="social-media-selector-option">
                            2 minutes
                          </span>
                        </Option>
                        <Option value={5}>
                          <span className="social-media-selector-option">
                            5 minutes
                          </span>
                        </Option>
                        <Option value={10}>
                          <span className="social-media-selector-option">
                            10 minutes
                          </span>
                        </Option>
                        <Option value={30}>
                          <span className="social-media-selector-option">
                            30 minutes
                          </span>
                        </Option>
                        <Option value={60}>
                          <span className="social-media-selector-option">
                            1 hour
                          </span>
                        </Option>
                        <Option value={120}>
                          <span className="social-media-selector-option">
                            2 hours
                          </span>
                        </Option>
                      </Select>
                    </Grid>
                  </Grid>
                </div>
                <StreamItems
                  streams={tab.streams}
                  refreshRate={parseInt(tab.refresh_rate)}
                  selectedTab={selectedTab}
                  reload={this.fetchStreamTabs}
                  toggleStreamMaker={this.toggleStreamMaker}
                  isStreamMakerOpen={this.state.streamMaker}
                  selectedSocial={this.state.selectedSocial}
                  selectedAccountId={this.state.selectedAccountId}
                />
              </div>
            ) : (
              <StreamInitiator
                selectedTab={selectedTab}
                reload={this.fetchStreamTabs}
                onChangeSocial={(val) => this.handleChangeSocial(val)}
                onChangeAccount={(val) => this.handleChangeAccount(val)}
              />
            )}
          </div>
        </Tab>
      )),
      tabData: items,
      selectedTab: selectedTab,
    }));
  };

  setForbidden = (forbidden = false) => {
    this.setState(() => ({
      forbidden,
    }));
  };

  fetchStreamTabs = () => {
    this.setState(() => ({
      loading: true,
    }));
    getStreams()
      .then((response) => {
        let selectedTab = response.filter((tab) => tab.selected === 1);
        selectedTab = !!selectedTab.length
          ? selectedTab[0].key
          : this.state.selectedTab;

        if (!!response.length) {
          this.setTabs(response, selectedTab);
        }

        this.setState(() => ({
          loading: false,
          forbidden: false,
          manualLoad: false,
        }));
      })
      .catch((error) => {
        this.setState(() => ({
          loading: false,
          manualLoad: false,
        }));
        if (error.response.status === 403) {
          this.setForbidden(true);
        }
      });
  };

  render() {
    let standardActions = [
      <FlatButton
        label="Cancel"
        secondary={true}
        onClick={this._onDialogCancel.bind(this)}
      />,
      <FlatButton
        label="Submit"
        primary={true}
        keyboardFocused={true}
        onClick={this._onDialogSubmit.bind(this)}
      />,
    ];

    let menuStyle = {
      display: this.state.showMenu ? "block" : "none",
      position: "absolute",
      top: this.state.menuPosition.top,
      left: this.state.menuPosition.left,
      backgroundColor: "#F0F0F0",
    };

    return (
      <div>
        <UpgradeAlert
          isOpen={this.state.forbidden && !this.state.loading}
          goBack={true}
          setForbidden={this.setForbidden}
        />
        <Compose />
        {!this.state.streamMaker && (
          <button onClick={this.toggleStreamMaker} className="streammaker-btn">
            +
          </button>
        )}

        {this.state.loading && <Loader />}

        {this.state.tabs.length > 0 ? (
          <div>
            <img
              className={`whole-refresh-btn ${
                this.state.loading && this.state.manualLoad ? "fa-spin" : ""
              } pull-right`}
              src="/images/monitor-icons/refresh.svg"
              onClick={() => {
                this.setState({ manualLoad: true });
                this.fetchStreamTabs();
              }}
            />
            <Tabs
              tabsClassNames={tabsClassNames}
              tabsStyles={tabsStyles}
              selectedTab={
                this.state.selectedTab ? this.state.selectedTab : "tab2"
              }
              onTabSelect={this.handleTabSelect.bind(this)}
              onTabAddButtonClick={this.handleTabAddButtonClick.bind(this)}
              onTabPositionChange={this.handleTabPositionChange.bind(this)}
              shouldTabClose={this.shouldTabClose.bind(this)}
              tabs={this.state.tabs}
              shortCutKeys={{
                close: ["alt+command+w", "alt+ctrl+w"],
                create: ["alt+command+t", "alt+ctrl+t"],
                moveRight: ["alt+command+tab", "alt+ctrl+tab"],
                moveLeft: ["shift+alt+command+tab", "shift+alt+ctrl+tab"],
              }}
              keepSelectedTab={true}
            />

            <div style={menuStyle}>
              <Menu>
                {this.state.contextTarget === "tab0" ? (
                  ""
                ) : (
                  <MenuItem
                    primaryText="Close"
                    onClick={this.closeFromContextMenu.bind(this)}
                  />
                )}
                <MenuItem
                  primaryText="Rename"
                  onClick={this.renameFromContextMenu.bind(this)}
                />
                <MenuItem
                  primaryText="Cancel"
                  onClick={this.cancelContextMenu.bind(this)}
                />
              </Menu>
            </div>

            {!!this.state.isClosedTab && (
              <Modal
                ariaHideApp={false}
                className="billing-profile-modal"
                isOpen={!!this.state.isClosedTab}
              >
                <div className="modal-title">{`Attention`}</div>
                <div className="modal-contents">{`Do you wish to delete this tab?`}</div>
                <div style={{ float: "right" }}>
                  <button
                    onClick={() => this.setState({ isClosedTab: false })}
                    className="cancelBtn"
                  >
                    No
                  </button>
                  <button
                    onClick={() => this.handleConfirmClose()}
                    className="cancelBtn"
                  >
                    Yes
                  </button>
                </div>
              </Modal>
            )}

            <Dialog
              title="Change tab name"
              ref="dialog"
              actions={standardActions}
              modal={true}
              open={this.state.dialogOpen}
              onShow={this._onDialogShow.bind(this)}
            >
              <TextField
                ref="input"
                id="rename-input"
                style={{ width: "90%" }}
              />
            </Dialog>
          </div>
        ) : (
          !this.state.loading && (
            <StreamInitiator
              selectedTab={this.state.selectedTab}
              reload={this.fetchStreamTabs}
              onChangeSocial={(val) => this.handleChangeSocial(val)}
              onChangeAccount={(val) => this.handleChangeAccount(val)}
            />
          )
        )}
      </div>
    );
  }
}

StreamTabs.childContextTypes = {
  muiTheme: PropTypes.object,
};

export default StreamTabs;
