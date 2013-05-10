
window.constants = {
	STORAGE_PREFIX: 'STOCK',
	REFRESH_INTERVAL: 1000 * 60 * 5, 
	ICON_NEUTRAL: '-',
	ICON_UP_ARROW: 'icon-arrow-up',
	ICON_DOWN_ARROW: 'icon-arrow-down',
	WEBSQL_DB_SZE: 5 * 1024 * 1024, // 5MB
	SQL_VALUE_BUY: 'BUY',
	SQL_VALUE_SELL: 'SELL',
	PRICE_NUM_DECIMAL: 3,
	ENTER_KEY: 13,
	// put any methods here that we want to put on silent in console object 
//	CONSOLE_NOOP: ['profile', 'profileEnd', 'time', 'timeEnd', 'debug'], //production console, exclude profiling/timing and debug logs
	CONSOLE_NOOP: ['log'] // development console, enable everything
};
window.constants.YAHOO = {
	ENDPOINT: 'http://finance.yahoo.com/webservice/v1/symbols/{}/quote?format=json',
	AUTOCOMPLETE: 'http://d.yimg.com/autoc.finance.yahoo.com/autoc?query={}&callback=YAHOO.Finance.SymbolSuggest.ssCallback',
	NEWS: 'http://pipes.yahoo.com/pipes/pipe.run?_id=Ti_CRJfx2xGC5Ghd1vC6Jw&_render=json&symbol={}'
};

(function(console) {
	var noop = function() {};
	// disable any method on console defined in constants
	for(var m in constants.CONSOLE_NOOP) {
		console[constants.CONSOLE_NOOP[m]] = noop;
	}
}(window.console));
