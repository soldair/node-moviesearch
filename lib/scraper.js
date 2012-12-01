/*
*
* Licensed under the MIT license:
* http://www.opensource.org/licenses/mit-license.php
*
*/
var jsdom = require('jsdom')
, request = require('request')
, dom = jsdom.jsdom
, url = require('url')
, http = require('http')
, fs = require('fs')
, vm = require('vm')
;

module.exports = exports = {
  get:function(url,headers,cb){
    if(headers.call){
      cb = headers;
      headers = {};
    }

    request({url:url,headers:headers||{}},function(e,r,body){
      cb(e,body);
    });
  },
	loadDom:function(xml_html,config){
		try{
			return jsdom.jsdom(xml_html,null,config||{
					features:{
						ProcessExternalResources: false
						,FetchExternalResources: false
					}
			});
			
		}catch (e) {
			console.log("get_dom exception: "+e);
		}
		return false;
	},
	injectJquery:function(document,cb){
		if(document.parentWindow.jQuery) {
			cb(false,document.parentWindow);
			return;
		}
    jsdom.jQueryify(document.parentWindow,function(err,data){
      cb(err,data);
    });
	}
};


function CookieJar(){}

CookieJar.prototype = {
	jar:{},
	set:function(cookieData){
		var z = this;
		cookieData.forEach(function(cookie){
			var parts = cookie.split(';')
				, kv = parts.shift();
			if(kv.length){
				kv = kv.split('=');
				z.jar[kv.shift()] = kv.shift();
			}
		})
	},
	get:function(){
		var cookies = '';
		for(var i in this.jar) {
			cookies += i+'='+this.jar[i]+'; ';
		}
		return cookies;
	},
	clear:function(){
		this.jar = {};
	}
}

function extend(_e,object){
	var out = {};
	for(var i in object){
		out[i] = object[i];
	}
	
	for( var k in _e){
		out[k] = _e[k];
	}
	
	return out;
}
