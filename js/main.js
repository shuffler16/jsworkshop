var storage = {};
storage.indexedDBStorage = function() {
	this.db = null;
	this.init = function() {
		var self = this;
		console.info('initializing indexedDBStorage');
		
		// retrieve correct indexeddb based on the browser
		window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
		window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
		window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;
		
		// create 
		var request = window.indexedDB.open('stocks', 1);
		request.onerror = function(event) {
			console.error(event.target.errorCode);
		};
		request.onsuccess = function(event) {
			console.debug('Assigning db to variable');
			self.db = request.result;
			self._removeAll();
		};
		request.onupgradeneeded = function(event) {
			console.debug('Creating object store');
		    var db = event.target.result;
		    var objectStore = db.createObjectStore('transactions', { keyPath:  'id', autoIncrement:true});
		};
		
	},
	this.saveTransaction = function(trans) {
		var transaction = this.db.transaction([ 'transactions' ], 'readwrite');
		var store = transaction.objectStore('transactions');
		var request = store.put(trans.toJSON());

		request.onsuccess = function(e) {
			console.debug('Successfully inserted transaction');
		};

		request.onerror = function(e) {
			console.error(e.value);
		};
	},
	this._removeAll = function() {

		var transaction = this.db.transaction([ 'transactions' ], 'readwrite');
		transaction.objectStore('transactions').openCursor().onsuccess = function(event) {
			var cursor = event.target.result;
			if(cursor) {
				transaction.objectStore('transactions').delete(cursor.key);
				cursor.continue();
			}
		};
		
	}
};

storage.webSQLStorage = function() {
	this.db = null;
	this.init = function() {
		console.info('initializing webSQLStorage');
		this.db = openDatabase('stocks', '1.0', 'storage for transactions when buying/selling stocks', constants.WEBSQL_DB_SZE);
		var isInitialized = localStorage.getItem('dbinit');
		if(!isInitialized) {
			console.warn('Datastore is not yet initialized, creating tables');
			this.db.transaction(function(tx) {
				tx.executeSql("CREATE TABLE IF NOT EXISTS transactions (id integer primary key asc, symbol text, price real, quantity integer, type text, created_on datetime)", []);
		    });
			this.db.transaction(function(tx) {
				tx.executeSql("CREATE TABLE IF NOT EXISTS stocks (id integer primary key asc, name text, symbol text, price real, ts integer, volume int, created_on datetime)", []);
			});
			localStorage.setItem('dbinit', true);
		}
	},
	this.getStock = function(stock) {
		this.db.transaction(function(tx) {
			tx.executeSql('SELECT FROM stocks where symbol = ?', [stock.get('symbol')], 
			function(tx, resultSet) { 
				console.debug('Sucessfully fetched transaction');
				stock.merge(results.rows.item(i));
				stock.trigger('fetch-success')
			},
			function(e) { 
				console.error('An error occured while fetching stock from db.');
				stock.trigger('fetch-failed')
			}
			);
		});			
	},
	this.saveStocks = function(stock) {
		this.db.transaction(function(tx) {
			var createdOn = new Date();
			tx.executeSql('INSERT INTO stocks(name, symbol, price, ts, volume, created_on) VALUES (?,?,?,?,?, ?)',
					[ stock.get('name'), stock.get('symbol'), stock.get('price'), stock.get('ts'), stock.get('volume'), createdOn], 
			function(tx, results) { 
				console.debug('Sucessfully created stock');
				stock.set('id', resultSet.insertId);
				stock.trigger('save-success')
			},
			function(e) { 
				console.error('An error occured while saving stock.');
				stock.trigger('save-failed')
			}
			);
		});			
	},
	this.saveTransaction = function(trans) {
		this.db.transaction(function(tx) {
			var createdOn = new Date();
			tx.executeSql('INSERT INTO transactions(symbol, price, quantity, type, created_on) VALUES (?,?,?,?,?)',
				[ trans.get('symbol'), trans.get('price'), trans.get('quantity'), trans.get('type'), createdOn], 
				function(tx, resultSet) { 
					console.debug('Sucessfully created transaction');
					trans.set('id', resultSet.insertId);
					trans.set('createdOn', createdOn);
					trans.trigger('save-success')
				},
				function(e) { 
					console.error('An error occured while saving transaction.');
					trans.trigger('save-failed')
				}
			);
		});			
	},
	this.getAllTransactions = function(transactionCollection) {
		this.db.transaction(function(tx) {
			var createdOn = new Date();
			tx.executeSql('SELECT * FROM transactions ORDER BY id DESC',[], 
				function(tx, results) { 
					var len = results.rows.length;
					for (i = 0; i < len; i++) {
						transactionCollection.add(new app.models.StockTransaction(results.rows.item(i)));
					}
				},
				function(e) { 
					console.error('An error occured while saving transaction.');
				}
			);
		});		
	}
}

// factory to choose whether to use indexedDB or webSQL based on browser support
storage.Factory = (function(localDB) {
	this.localDB = localDB;
	this.init = function(localDB) {
		console.debug('initializing localDB instance');
		this.localDB.init();
	}();
	return {
		getLocalDB : function() {
			return localDB; 
		}
	}
}//(new storage.indexedDBStorage()));
(Modernizr.websqldatabase ? new storage.webSQLStorage() : new storage.indexedDBStorage()));

var app = {
	models: {},
	collections: {},
	views: {}
};
app.models.StockNews = function(title, description, pubDate, link) {
	this.title = title;
	this.description = description;
	this.pubDate = pubDate;
	this.link = link;
}
app.models.AutoCompleteStock = function(value, label) {
	this.value = value;
	this.label = label + "(" + value + ")";
}

app.models.StockTransaction = Backbone.Model.extend({
	initialize: function(options) {
		this.localDB = storage.Factory.getLocalDB();
		if(options) {
			this.set('id', options.id);
			this.set('symbol', options.symbol);
			this.set('price', parseFloat(options.price).toFixed(constants.PRICE_NUM_DECIMAL));
			this.set('quantity', options.quantity);
			this.set('type', options.type);
			this.set('createdOn', moment(options.created_on).format('MM/DD/YY'));
		}
	},
	sync: function (method, model, options) {
		options || (options= {});
		switch(method) {
			case 'create':
				console.debug('creating transaction ');
				this.localDB.saveTransaction(this);
				break;
			case 'read':
				console.debug('reading individual transaction is not supported'); 
				break;
			case 'update':
				console.debug('updating of transaction is not supported'); 
				break;
			case 'delete':
				console.error('removing of transaction is not supported');
				break;
		}
	}
});
app.models.StockTransaction.newBuyTransaction = function(stock, qty) {
	var transaction = new app.models.StockTransaction();
	transaction.set('symbol', stock.get('symbol'));
	transaction.set('price', stock.get('price'));
	transaction.set('quantity', qty); 
	transaction.set('type', constants.SQL_VALUE_BUY); 	
	return transaction;
}
app.models.StockTransaction.newSellTransaction = function(stock, qty) {
	var transaction = new app.models.StockTransaction();
	transaction.set('symbol', stock.get('symbol'));
	transaction.set('price', stock.get('price'));
	transaction.set('quantity', qty);  
	transaction.set('type', constants.SQL_VALUE_SELL); 	
	return transaction;
}

app.models.Stock = Backbone.Model.extend({
	defaults: {
		status: constants.ICON_NEUTRAL
	},
	initialize: function() {
		this.localDB = storage.Factory.getLocalDB();
		this.bind("change:price", function(model, newPrice) {
			var oldPrice = model.previous('price');
			if(oldPrice) {
				console.debug('old=' + oldPrice + ", new=" + newPrice);
				model.set('status', (newPrice > oldPrice ? constants.ICON_UP_ARROW : constants.ICON_DOWN_ARROW));
			}
	    });
	},
	parse: function (response) {
		this.set('name', response.fields['name']);
		this.set('price', parseFloat(response.fields['price']).toFixed(constants.PRICE_NUM_DECIMAL));
		this.set('symbol', response.fields['symbol']); 
		this.set('ts', response.fields['ts']);
		this.set('volume', response.fields['volume']);
		this.set('lastUpdated', new Date());
		this.save();
	},
	fetch: function (options) {
		options || (options = {});
		var self = this;
		var code = this.get('id');
		$.ajax({
			type : 'GET',
			url : constants.YAHOO.ENDPOINT.replace("{}", code),
			dataType : 'jsonp', 
			beforeSend: function(xhr) {
				console.time('Getting details for ' + code);
			},
			done: function(data) {
				console.timeEnd('Getting details for ' + code);
			},
			success : function(json) {
				try {
					
					var resource = json.list.resources[0].resource;
					self.parse(resource);
					console.info('Successfully fetched ' + code);
				} catch (e) {
					console.error("Cannot parse stock: " + code);
					self.trigger('no-stock');
				}
			}
		});		
	},
	
	sync: function (method, model, options) {
		options || (options= {});
		switch(method) {
			case 'create':
				console.debug('creating stock ' + model.key());
				localStorage.setItem(model.key(), JSON.stringify(model));
				break;
			case 'read':
				var result = localStorage.getItem(model.key());
				if (result){
					console.debug('Found item from localStorage');
					result = JSON.parse(result);
					options.success && options.success(result);
				}
				else {
					console.debug('Not found from localStorage');
					model.fetch(options);
				}
				break;
			case 'update':
				console.debug('updating stock ' + model.key()); 
				this.localDB.saveStocks(model);
				localStorage.setItem(model.key(), JSON.stringify(model));
				break;
			case 'delete':
				console.debug('removing stock ' + model.key()); 
				localStorage.removeItem(model.key());
				break;
		}
	},
	merge: function(stock) {
		this.set('id', stock.id);
		this.set('name', stock.name);
		this.set('price', parseFloat(stock.price).toFixed(constants.PRICE_NUM_DECIMAL));
		this.set('symbol', stock.symbol); 
		this.set('ts', stock.ts);
		this.set('volume', stock.volume);
	},
	getNews: function() {
		var self = this;
		$.ajax({
			type : 'GET',
			url : constants.YAHOO.NEWS.replace("{}", self.get('id')),
			success : function(news) {
				try {
					var items = news.value.items;
					self.stockNews = _.map(items, function(item) {
						return new app.models.StockNews(item.title, item.description, item.pubDate, item.link);
					});
					self.trigger('news');
				} catch (e) {
					console.error("Error getting news");
				}
			}
		});	
	},
	key: function() {
		return (constants.STORAGE_PREFIX + '-' + this.get('id')).toUpperCase();
	}
})

app.collections.StockCollection = Backbone.Collection.extend({
	model: app.models.Stock,
	comparator: function(item) {
        return item.get('symbol');
    },
	reset: function() {
		return this._getAll();
	},
	fetch: function() {
		return this._getAll();
	},
	refresh: function() {
		this.models.forEach(function(model) {
			model.fetch();
		});
	},
	_getAll: function() {
		if(localStorage) {
			console.time("Getting all stocks");
			for(var i = 0; i < localStorage.length; i++) {
				var key = localStorage.key(i); 
				if(key.startsWith(constants.STORAGE_PREFIX)) {
					this.add(JSON.parse(localStorage.getItem(key)));
				}
			}
			console.timeEnd("Getting all stocks");
		}
		return this;
	}
})
app.collections.StockTransactionCollection = Backbone.Collection.extend({
	model: app.models.StockTransaction,
	comparator: function(item) {
		return -item.get(this._sortKey());
	},
	initialize: function(options) {
		var self = this;
		this.localDB = storage.Factory.getLocalDB();
		this.on('save-success', this.sort, this); //listen for model changes
	},
	reset: function() {
		return this._getAll();
	},
	fetch: function() {
		return this._getAll();
	},
	_getAll: function() {
		this.localDB.getAllTransactions(this);
		return this;
	},
	_sortKey: function() {
		return 'id';
	}
});

app.views.StockView = Backbone.View.extend({
	tagName: 'div',
	template: Mustache.compile($("#stockViewTemplate").html()),
	events: {
		'click a[data-reload]': 'reloadStock',
		'click a[data-remove]': 'destroyModel',
		'click a[data-buy]': 'buyStock',
		'click a[data-sell]': 'sellStock',
		'click a[data-news]': 'showNews'
	},
	initialize: function (options) {
		this.listenTo(this.model, 'change', this.render);
		this.listenTo(this.model, 'destroy', this.remove);
		this.listenTo(this.model, 'news', this.displayNews);
		this.listenTo(this.model, 'no-stock', this.destroy);
		this.transactions = options.transactions;
	},
	render: function() {
		this.$el.html(this.template(this.model.toJSON()));
		this.$el.closest('.accordion').accordion('destroy').accordion({header: 'div.header'});
	},
	reloadStock: function(e) {
		e.preventDefault();
		console.debug('Refreshing stock ' + this.model.get('id'));
		this.model.fetch();
	},
	destroyModel: function(e) {
		if(confirm('Are you sure you want to remove this stock? [' + this.model.get('id') + ']')) {
			this.model.destroy();
		}
	},
	buyStock: function() {
		console.log('Buying ' + this.model.get('id'));
		var qty = this._getQuantity();
		if(confirm('Are you sure you want to buy ' + qty + ' ' + this.model.get('id').toUpperCase()  + ' stock?')) {
			console.time('[BUY] Adding new stock in storage');
			var transaction = app.models.StockTransaction.newBuyTransaction(this.model, qty);
			transaction.save();
			this.transactions.add(transaction);
			this._clearQuantity();
			console.timeEnd('[BUY] Adding new stock in storage');
		}
	},
	sellStock: function() {
		console.log('Selling ' + this.model.get('id'));
		var qty = this._getQuantity();
		if(confirm('Are you sure you want to sell ' + qty + ' ' + this.model.get('id').toUpperCase()  + ' stock?')) {
			console.time('[SELL] Adding new stock in storage');
			var transaction = app.models.StockTransaction.newSellTransaction(this.model, this._getQuantity());
			transaction.save();
			this.transactions.add(transaction);
			this._clearQuantity();
			console.timeEnd('[SELL] Adding new stock in storage');
		}
	},
	showNews: function() {
		console.log('Showing news for ' + this.model.get('id'));
		this.model.getNews();
	},
	displayNews: function() {
		console.log('News event was fired.');
		var newsView = new app.views.StockNewsListView({newsList: this.model.stockNews})
		newsView.render();
	},
	destroy: function() {
		this.model.destroy();
	},
	_getQuantity: function() {
		return this.$('input[name=qty]').val();
	},
	_clearQuantity: function() {
		this.$('input[name=qty]').val('');
	}
	
})

app.views.StockCollectionView = Backbone.View.extend({
	el: "#stocksContainer",
	initialize: function(options) {
		this.listenTo(this.collection, 'add', this._addOne, this);
		this.transactions = options.transactions;
		
	},
	render: function() {
		console.time('Rendering list of stocks')
		this.collection.forEach(this._addOne, this);
		console.timeEnd('Rendering list of stocks')
		return this;
	},
	_addOne: function(stock) {
		console.profile('Rendering ' + stock.get('id'));
		var stockView = new app.views.StockView({model: stock, transactions: this.transactions});
		stockView.render();
		this.$el.append(stockView.el);		
		this.$el.accordion('destroy').accordion({header: 'div.header'});
		console.profileEnd('Rendering ' + stock.get('id'));
	}
})

app.views.StockTransactionView = Backbone.View.extend({
	tagName: 'tr',
	template: Mustache.compile($("#stockTransactionTemplate").html()),
	initialize: function(options) {
		this.model = options.model;
		this.listenTo(this.model, 'save-success', this.render);
	},
	render: function() {
		this.$el.attr('id', 'transaction-' + this.model.get('id'));
		this.$el.html(this.template(this.model.toJSON()));
		return this;
	}
})

app.views.StockTransactionListView = Backbone.View.extend({
	el: '#transactionsContainer tbody',
	initialize: function(options) {
		this.collection = options.collection;
		this.listenTo(this.collection, 'add', this._addOne, this);
		this.listenTo(this.collection, 'sort', this._sortCollection, this);
	},
	render: function() {
		_.each(this.collection, function(item) {
			this._addOne(item);
		}, this);
		return this;
	},
	_addOne: function(item) {
		var view = new app.views.StockTransactionView({model: item}).render();
		this.$el.append(view.el);
	},
	_sortCollection: function(item) {
		var trList = _.map(this.$el.find('tr'), function(tr) {
			return new function() {
				this.id = parseInt($(tr).attr('id').substring('transaction-'.length));
				this.content = tr;
			}
		});
		var sortedList = _.sortBy(trList, function(tr) {
			return -tr.id;
		});
		
		_.each(sortedList, function(obj) {
			this.$el.append(obj.content);
		}, this);
	}
})
app.views.StockNewsView = Backbone.View.extend({
	tagName: 'article',
	template: Mustache.compile($("#stockNewsTemplate").text()),
	initialize: function(options) {
		this.news = options.news;
	},
	render: function() {
		this.$el.html(this.template(this.news));
		return this;
	}
})

app.views.StockNewsListView = Backbone.View.extend({
	el: "#stockNews",
	initialize: function(options) {
		options || (options = {})
		this.newsList = options.newsList;
		this.$el.empty();
	},
	render: function() {
		_.each(this.newsList, function(item) {
			var newsView = new app.views.StockNewsView({news: item}).render();
			this.$el.append(newsView.el);
		}, this);
		return this;
	}
})

app.views.SearchStockForm = Backbone.View.extend({
	responseTimeout: null,
	el: "#stockSearchForm",
	initialize: function(options) {
		options || (options={});
		this.stocks = options.stocks;
	},
	events: {
		submit: 'save'
	},
	save: function(e, ui) {
		e.preventDefault();
		var symbol;
		if(ui) {
			symbol = ui.item.value;
		}
		else {
			symbol = this.$('input[name=stockSymbol]').val();
		}
		this._save(symbol);
	},
	render: function() {
		var view = this;
		this.$("input[name=stockSymbol]").autocomplete({
			source: function(request, response) {
				clearTimeout(view.responseTimeout);
				$.ajax({
					type : 'GET',
					url : constants.YAHOO.AUTOCOMPLETE.replace("{}", request.term),
					dataType : 'jsonp'
				});
				view.responseTimeout = setTimeout(function() { response(results) }, 500);
			},
			select: function(event, ui) {
				view.save(event, ui);
			}
		});
		return this;
	},
	init: function () {
		var self = this;
		this.$('input[name=stockSymbol]').focus();
		this.$('input[name=stockSymbol]').keypress = function(e) {
			if(e.keyCode == constants.ENTER_KEY) {
				self._save(this.$('input[name=stockSymbol]').val());
			}
		}
	},
	_save: function(symbol) {
		var stock = new app.models.Stock({id: symbol});
		stock.fetch();
		this.stocks.add(stock);
		// clear
		this.$('input[name=stockSymbol]').val('');
	}
	
})

// pseudo yahoo code to parse autocomplete
var results = [];
var YAHOO = {
	Finance: {
		SymbolSuggest: {
			ssCallback: function(data) {
				results = _.map(data.ResultSet.Result, function(obj) {
					return new app.models.AutoCompleteStock(obj['symbol'], obj['name'])
				});
			}
		}
	}
};

$(function() {
	$('.accordion').accordion({
		active: 1,
		collapsible:true,
		heightStyle: "content",
		beforeActivate: function(event, ui) {
			// The accordion believes a panel is being opened
			if (ui.newHeader[0]) {
				var currHeader  = ui.newHeader;
				var currContent = currHeader.next('.ui-accordion-content');
				// The accordion believes a panel is being closed
			} else {
				var currHeader  = ui.oldHeader;
				var currContent = currHeader.next('.ui-accordion-content');
			}
			// Since we've changed the default behavior, this detects the actual status
			var isPanelSelected = currHeader.attr('aria-selected') == 'true';
			
			// Toggle the panel's header
			currHeader.toggleClass('ui-corner-all',isPanelSelected).toggleClass('accordion-header-active ui-state-active ui-corner-top',!isPanelSelected).attr('aria-selected',((!isPanelSelected).toString()));
			
			// Toggle the panel's icon
			currHeader.children('.ui-icon').toggleClass('ui-icon-triangle-1-e',isPanelSelected).toggleClass('ui-icon-triangle-1-s',!isPanelSelected);
			
			// Toggle the panel's content
			currContent.toggleClass('accordion-content-active',!isPanelSelected)    
			if (isPanelSelected) { currContent.slideUp(); }  else { currContent.slideDown(); }
			
			return false; // Cancels the default action
		}
	});
	
	var transactions = new app.collections.StockTransactionCollection();
	transactions.fetch();
	
	var transactionView = (new app.views.StockTransactionListView({collection: transactions})).render();
	
	var stocks = (new app.collections.StockCollection()).reset();
	var view = new app.views.StockCollectionView({collection: stocks, transactions: transactions}).render();
	(new app.views.SearchStockForm({stocks: stocks})).render().init();
	
	
	setInterval(function() {
		stocks.refresh();
	}, constants.REFRESH_INTERVAL);
	
});