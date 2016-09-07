(function () {
  var queryTable = function (table, rowsProp, errorProp) {
    var requestData = {
      url: '/api/db/tables/' + table.name + '/data',
      method: 'GET',
      extract: grice.extractStatusCode
    };

    var success = function (data) {
      m.startComputation();
      rowsProp(data.rows);
      m.endComputation();
    };

    var failure = function (data) {
      rowsProp([]);
      errorProp(data.error);
    };

    return m.request(requestData).then(success, failure);
  };

  grice.PaginationComponent = {
    controller: function (table, rows, page, perPage, queryParams) {
      this.table = table;
      this.rows = rows;
      this.page = page;
      this.perPage = perPage;
      this.queryParams = queryParams;
    },
    view: function (c) {
      var nextUrl = grice.generateTableUrl(c.table.name, c.page + 1, c.perPage, c.queryParams);
      var prevUrl = grice.generateTableUrl(c.table.name, c.page - 1, c.perPage, c.queryParams);
      var prevEl;
      var nextEl;

      if (c.page <= 1) {
        prevEl = '<';
      } else {
        prevEl = m('a', {href: prevUrl}, '<');
      }

      if (c.rows.length < c.perPage) {
        nextEl = '>';
      } else {
        nextEl = m('a', {href: nextUrl}, '>');
      }

      return m('div.pagination', [
          m('div.previous', prevEl),
          m('div.page', 'Page ' + c.page),
          m('div.next', nextEl)
      ]);
    }
  };

  grice.FilterItem = {
    controller: function (filter, idx, remove) {
      this.idx = idx;
      this.remove = remove;
      this.filter = filter;
      this.valueHandler = function (value) {
        filter.value(value);
        return value;
      };
    },
    view: function (c) {
      var filterOptions = [m('option', {value: '__not_selected__'}, 'choose a filter')];

      Object.keys(grice.FILTER_TYPES).forEach(function (type) {
        var label = grice.FILTER_TYPES[type];

        filterOptions.push(m('option', {value: type}, label));
      });

      var filterType = c.filter.type();
      filterType = filterType !== null ? filterType : '__not_selected__';
      var select = m('select.filter-select', {
        value: filterType,
        onchange: m.withAttr('value', c.filter.type)
      }, filterOptions);
      var value = m('input[type=text].filter-value', {
        value: c.filter.value(),
        oninput: m.withAttr('value', c.valueHandler)
      });
      var remove = m('span.fa.fa-trash.remove', {onclick: function () {c.remove(c.idx);}}, '');

      // TODO: putting a key here has no affect on DOM rendering, even though the Mithril docs imply that it should.
      // Instead just putting the key on the ColumnFilter object is good enough, even though that never gets put on any
      // mithril objects, so I'm not sure how it's tracking it.
      return m('div.column-filter', [select, value, remove]);
    }
  };

  grice.FilterDialog = {
    // TODO: make FilterDialog be in charge of generating keys for FilterItems.
    controller: function (column, queryParams, dialogOpen) {
      this.column = column;
      this.queryParams = queryParams;
      this.dialogOpen = dialogOpen;

      var name = column.name;
      var fullName = column.table + '.' + column.name;
      var allFilters = queryParams.filters;
      var filters = allFilters[fullName] ? allFilters[fullName] : allFilters[name];

      if (filters !== undefined && filters !== null) {
        this.filters = m.prop(filters);
      } else {
        this.filters = m.prop([]);
      }
      this.originalFilters = grice.shallowCopy(this.filters());
    },
    view: function (c) {
      var className = 'filter-dialog';
      var filterTitle = m('div.filter-title', c.column.table + '.' + c.column.name);
      var filterItems = [];
      var filtersContainer = m('div.column-filters', filterItems);
      var bodyItems = [filterTitle, filtersContainer];
      var dialogBody = m('div.filter-dialog-body', bodyItems);

      var close = function () {
        c.dialogOpen(false);
      };

      var cancel = function () {
        var filters = c.queryParams.filters;
        var name = c.column.name;
        var fullName = c.column.table + '.' + c.column.name;

        if (filters[fullName]) {
          filters[fullName] = c.originalFilters;
        } else if (filters[name]) {
          filters[name] = c.originalFilters;
        }

        c.filters(grice.shallowCopy(c.originalFilters));

        close();
      };

      var save = function () {
        var filters = c.queryParams.filters;
        var name = c.column.name;
        var fullName = c.column.table + '.' + c.column.name;

        // Have to explicitly set here because queryParams will not have been initialized with this column's filters if
        // there were none on the URL.
        if (filters[name]) {
          filters[name] = c.filters();
        } else {
          filters[fullName] = c.filters();
        }

        // TODO: get table name and perPage from somewhere else.
        // Reset the page number when we change filters.
        var url = grice.generateTableUrl(grice._table.name, null, grice._perPage, c.queryParams);
        window.location = url;
      };

      var addFilter = function () {
        var filters = c.filters();
        filters.push(new grice.ColumnFilter(c.column.table + '.' + c.column.name, null, ''));
        c.filters(filters);
      };

      var removeFilter = function (idx) {
        var filters = c.filters();
        filters.splice(idx, 1);
        c.filters(filters);
      };

      var closeButton = m('div.close-button', {onclick: close}, 'x');
      var saveButton = m('div.save-button', {onclick: save}, 'Save');
      var cancelButton = m('div.cancel-button', {onclick: cancel}, 'Cancel');
      var actionButtons = m('div.action-buttons', [cancelButton, saveButton]);


      if (!c.dialogOpen()) {
        className += ' closed';
      }

      if (!c.filters().length) {
        filterItems.push(m('div.filter-item', 'No filters.'));
      } else {
        c.filters().forEach(function (filter, idx) {
          filterItems.push(m(grice.FilterItem, filter, idx, removeFilter));
        });
      }

      bodyItems.push(m('div.add-button', {onclick: addFilter}, 'Add Filter'));

      return m('div', {class: className}, [closeButton, dialogBody, actionButtons]);
    }
  };

  grice.ColumnHeader = {
    controller: function (tableName, column, queryParams, showChart) {
      this.tableName = tableName;
      this.column = column;
      this.queryParams = queryParams;
      this.showChart = showChart;
      this.filterDialogOpen = m.prop(false);
    },
    view: function (c) {
      var colType = c.column.type;
      var menuItems = [];
      var sortIdx = -1;
      var sort = c.queryParams.sorts.find(function (sort, idx) {
        var sortCol = sort.column;
        var found = c.column.name == sortCol || (c.column.table + '.' + c.column.name) == sortCol;

        if (found) {
          sortIdx = idx;
        }

        return found;
      });

      var removeSort = function () {
        if (sortIdx > -1) {
          c.queryParams.sorts.splice(sortIdx, 1);
        }
      };

      var applySort = function (type) {
        removeSort();
        var sort = c.column.table + '.' + c.column.name + ',' + type;
        c.queryParams.sorts.push(sort);
        window.location = grice.generateTableUrl(c.tableName, c.queryParams.page, c.queryParams.perPage, c.queryParams);
      };

      var sortAscending = function () {
        applySort('asc');
      };

      var sortDescending = function () {
        applySort('desc');
      };

      var clearSort = function () {
        removeSort();
        window.location = grice.generateTableUrl(c.tableName, c.queryParams.page, c.queryParams.perPage, c.queryParams);
      };

      var showFilterDialog = function () {
        c.filterDialogOpen(true);
      };

      if (sort) {
        menuItems.push(m('div.menu-item', {onclick: clearSort}, 'Clear sort'));
      }

      menuItems.push(m('div.menu-item', {onclick: sortAscending}, 'Sort ascending'));
      menuItems.push(m('div.menu-item', {onclick: sortDescending}, 'Sort descending'));
      menuItems.push(m('div.menu-item', {onclick: showFilterDialog}, 'Filter'));

      if (grice.NUMERIC_COLUMNS.indexOf(colType) > -1) {
        var showChart = function () {
          c.showChart(c.column);
        };

        menuItems.push(m('div.menu-item', {onclick: showChart}, 'Chart'));
      }

      var menu = m('div.column-menu', menuItems);
      var filterDialog = m(grice.FilterDialog, c.column, c.queryParams, c.filterDialogOpen);
      var columnHeaderItems = [m('div.column-name', c.column.name), menu, filterDialog];

      return m('th', m('div.column-header.u-full-width', [columnHeaderItems]));
    }
  };

  grice.TableDataComponent = {
    controller: function (table, columns, rows, queryParams, showChart) {
      this.table = table;
      this.columns = columns;
      this.rows = m.prop(rows);
      this.queryError = m.prop(null);
      this.queryParams = queryParams;
      this.showChart = showChart;

      if (rows == null) {
        queryTable(this.table, this.rows, this.queryError);
      }
    },
    view: function (c) {
      var headerCols = c.columns.map(function (col) {
        return m(grice.ColumnHeader, c.table.name, col, c.queryParams, c.showChart);
      });
      var tableHeader = m('tr', headerCols);
      var tableBody;
      var queryError = c.queryError();
      var rows = c.rows();

      rows = rows ? rows : [];

      if (queryError !== null) {
        tableBody = m('tr', m('td.error', queryError));
      } else {
        tableBody = rows.map(function (row) {
          var cols = c.columns.map(function (col) {
            return m('td', row[col.table + '.' + col.name]);
          });

          return m('tr', cols);
        });
      }

      return m('table.table', [
          m('thead', tableHeader),
          m('tbody', tableBody)
      ]);
    }
  };

  grice.TableComponent = {
    controller: function () {
      this.table = grice._table;
      this.columns = grice._columns;
      this.rows = grice._rows;
      this.page = grice._page;
      this.perPage = grice._perPage;
      this.queryParams = grice.parseQueryParams();
      this.showChart = function (column) {
        window.location = grice.generateChartUrl(this.table.name, column, this.queryParams);
      }.bind(this);
    },
    view: function (c) {
      return m('div.db-table', [
        m('h3.table-name', c.table.name),
        m(grice.PaginationComponent, c.table, c.rows, c.page, c.perPage, c.queryParams),
        m(grice.TableDataComponent, c.table, c.columns, c.rows, c.queryParams, c.showChart),
        m(grice.PaginationComponent, c.table, c.rows, c.page, c.perPage, c.queryParams)
      ]);
    }
  };
})();
