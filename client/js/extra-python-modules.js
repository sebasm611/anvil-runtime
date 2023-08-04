Sk.builtinFiles.files['src/lib/anvil/ext_tables/__init__.py']="# Wrap any SQL database in a Data-Tables-like API\r\ntry:\r\n    from typing import Dict, Tuple\r\nexcept ImportError:\r\n    import collections\r\n    Tuple = Dict = collections.defaultdict(dict)\r\nimport anvil.server\r\nfrom anvil.server import Capability\r\n\r\n\r\nclass DatabaseImpl:\r\n    def search(self, table: \"TableInfo\"):\r\n        raise NotImplementedError\r\n\r\n    def add_row(self, table: \"TableInfo\", data: dict):\r\n        raise NotImplementedError\r\n\r\n    def update_row(self, table: \"TableInfo\", primary_key: tuple, updates: dict):\r\n        raise NotImplementedError\r\n\r\n    def delete_row(self, table: \"TableInfo\", primary_key: tuple):\r\n        raise NotImplementedError\r\n\r\n\r\ndef shared_data(gd, db_name):\r\n    return gd.shared_data(\"anvil.ext_tables/\"+db_name,\r\n                          local_data_factory=lambda: {\"TableInfo\": {}},\r\n                          remote_data_factory=lambda: {\"tables\": {}})\r\n\r\n@anvil.server.portable_class\r\nclass TableInfo:\r\n    def __init__(self, db_name, name, primary_key: Tuple[str], columns, db: DatabaseImpl):\r\n        self.db_name = db_name\r\n        self.name = name\r\n        self.primary_key = primary_key\r\n        self.columns = columns\r\n        self.db = db\r\n\r\n    @property\r\n    def safe_version(self):\r\n        return self\r\n\r\n    def __serialize__(self, gd):\r\n        return self.db_name, self.name, self.primary_key, self.columns\r\n\r\n    def __deserialize__(self, value, gd):\r\n        self.db_name, self.name, self.primary_key, self.columns = value\r\n        self.db = None\r\n    # def __serialize__(self, gd):\r\n    #     txdata, _ = shared_data(gd, self.db_name)\r\n    #     txdata[\"tables\"][self.name] = (self.primary_key, self.columns)\r\n    #     return self.db_name, self.name\r\n    #\r\n    # @classmethod\r\n    # def __new_deserialized__(cls, data, gd):\r\n    #     db_name, name = data\r\n    #     txdata, localdata = shared_data(gd, db_name)\r\n    #     inst = localdata[\"TableInfo\"].get(name)\r\n    #     if not inst:\r\n    #         primary_key, columns = txdata[\"tables\"][name]\r\n    #         inst = cls(db_name, name, primary_key, columns, None)\r\n    #     return inst\r\n\r\n\r\n@anvil.server.portable_class\r\nclass Table:\r\n    def __init__(self, info: TableInfo):\r\n        self.info = info\r\n        self.cap = anvil.server.Capability([\"ext_tables/\"+info.db_name, info.name])\r\n\r\n    def search(self):\r\n        if self.info.db:\r\n            return self.info.db.search(table=self.info)\r\n        else:\r\n            return anvil.server.call(\"anvil.ext_tables.search/\"+self.db_name, cap=self.cap)\r\n\r\n    def add_row(self, **data):\r\n        if self.info.db:\r\n            return self.info.db.add_row(table=self.info, data=data)\r\n        else:\r\n            return anvil.server.call(\"anvil.ext_tables.add_row/\"+self.db_name, cap=self.cap, data=data)\r\n\r\n\r\n@anvil.server.portable_class\r\nclass Row:\r\n    def __init__(self, table: TableInfo, data: dict, cap: Capability=None):\r\n        self.table = table\r\n        self.data = data\r\n        self.cap = cap or Capability([\"ext_tables/\"+table.db_name, table.name, self.primary_key])\r\n\r\n    def __getitem__(self, item):\r\n        return self.data[item]\r\n\r\n    def __setitem__(self, key, value):\r\n        self.update(**{key: value})\r\n\r\n    def __serialize__(self, gd):\r\n        return {\"table\": self.table.safe_version, \"data\": self.data, \"cap\": self.cap}\r\n\r\n    @property\r\n    def primary_key(self):\r\n        return tuple(self.data[col] for col in self.table.primary_key)\r\n\r\n    def update(self, **updates):\r\n        if self.table.db:\r\n            self.table.db.update_row(self.table, self.primary_key, updates)\r\n        else:\r\n            anvil.server.call(\"anvil.ext_tables.update_row/\"+self.table.db_name, cap=self.cap, updates=updates)\r\n        self.data.update(updates)\r\n\r\n    def delete(self):\r\n        if self.table.db:\r\n            self.table.db.delete_row(self.table, self.primary_key)\r\n        else:\r\n            anvil.server.call(\"anvil.ext_tables.delete_row/\"+self.table.db_name, cap=self.cap)\r\n";Sk.builtinFiles.files['src/lib/anvil/util.py']="from anvil.server import serializable_type\n\n\ndef _wrap(value):\n    if isinstance(value, (WrappedObject, WrappedList)):\n        return value\n    elif isinstance(value, dict):\n        return WrappedObject(value)\n    elif isinstance(value, list):\n        wl = WrappedList()\n        for i in value:\n            wl.append(i)\n        return wl\n    else:\n        return value\n\n\n@serializable_type\nclass WrappedObject(dict):\n    _name = None\n    _module = None\n\n    def __init__(self, d=None, **kwargs):\n\n        if d and isinstance(d, dict):\n            for k in d.keys():\n                self.__setitem__(k, d[k])\n\n        for k in kwargs.keys():\n            self.__setitem__(k, kwargs[k])\n\n    def __getattr__(self, key):\n        return self.__getitem__(key)\n\n    def __setattr__(self, key, value):\n        self.__setitem__(key, value)\n\n    def __setitem__(self, key, value):\n        dict.__setitem__(self, key, _wrap(value))\n\n    def __getitem__(self, key):\n        _sentinel = WrappedObject()\n        r = dict.get(self, key, _sentinel)\n\n        if r is _sentinel:\n            dict.__setitem__(self, key, _sentinel)\n\n        return r\n\n    def __repr__(self):\n        n = self._name or \"WrappedObject\"\n        m = self._module + \".\" if self._module else \"\"\n        return \"%s%s<%s>\" % (\n            m, n, \", \".join([\"%s=%s\" % (k, repr(self[k])) for k in self.keys()])\n        )\n\n    def __serialize__(self, global_data):\n        return dict(self)\n\n    def __deserialize__(self, data, global_data):\n        self.__init__(data)\n\n    def __copy__(self):\n        return self.__class__(dict.copy(self))\n\n    def __deepcopy__(self, memo):\n        # lazy load this - its only need on the \n        # server and we don't want to load copy on the client\n        from copy import deepcopy\n        return self.__class__(deepcopy(dict(self)))\n\n\n@serializable_type\nclass WrappedList(list):\n    def __init__(self, lst=[]):\n        for x in lst:\n            self.append(x)\n\n    def append(self, item):\n        list.append(self, _wrap(item))\n\n    def extend(self, items):\n        for i in items:\n            self.append(i)\n\n    def insert(self, offset, item):\n        list.insert(self, offset, _wrap(item))\n\n    def __serialize__(self, global_data):\n        return list(self)\n\n    def __deserialize__(self, data, global_data):\n        self.__init__(data)\n\n    def __copy__(self):\n        return self.__class__(list.copy(self))\n\n    def __deepcopy__(self, memo):\n        from copy import deepcopy\n        return self.__class__(deepcopy(list(self)))";Sk.builtinFiles.files['src/lib/plotly/__init__.py']="import sys as _sys\r\n\r\nfrom anvil.server import portable_class as _portable\r\nfrom anvil.util import WrappedObject as _wo\r\n\r\nfrom ._schema import schema as _root_schema\r\nfrom ._cls_overrides import _overrides\r\n\r\n_ModType = type(_sys)\r\n\r\n\r\ndef _cache(fn):\r\n    cached = {}\r\n\r\n    def wrapper(name, module, trace_type=None):\r\n        args = (name, module, trace_type)\r\n        seen = cached.get(args)\r\n        if seen is not None:\r\n            return seen\r\n        rv = fn(name, module, trace_type)\r\n        cached[args] = rv\r\n        return rv\r\n\r\n    return wrapper\r\n\r\n\r\n@_cache\r\ndef _gen_cls(name, module, trace_type=None):\r\n    try:\r\n        cls = _overrides[module + \".\" + name]\r\n        cls.__module__ = module\r\n        cls.__name__ = name\r\n    except KeyError:\r\n        d = {\"_name\": name, \"_module\": module, \"__module__\": module}\r\n        if trace_type:\r\n\r\n            def __init__(self, d=None, **kws):\r\n                _wo.__init__(self, d, type=trace_type, **kws)\r\n\r\n            d[\"__init__\"] = __init__\r\n        cls = type(name, (_wo,), d)\r\n\r\n    return _portable(cls)\r\n\r\n\r\nclass _LazyPlotlyMod(_ModType):\r\n    __slots__ = \"_schema_\"\r\n\r\n    def __init__(self, name, schema, package=True):\r\n        _ModType.__init__(self, name, None)\r\n        path = name.replace(\".\", \"/\")\r\n        self.__file__ = path + \"/__init__.py\" if package else path + \".py\"\r\n        self._schema_ = schema\r\n        self.__package__ = name  # might be overridden\r\n\r\n    def __getattr__(self, attr):\r\n        if attr == \"__all__\":\r\n\r\n            def ignore(x):\r\n                if x.startswith(\"_\"):\r\n                    return True\r\n                defn = self._schema_.get(x)\r\n                return defn is not None and defn[\"module\"].endswith(\"_deprecations\")\r\n\r\n            self.__all__ = sorted(x for x in self.__dir__() if not ignore(x))\r\n            return self.__all__\r\n\r\n        cls_schema = self._schema_.get(attr)\r\n        if cls_schema is not None:\r\n            cls = _gen_cls(attr, **cls_schema)\r\n            setattr(self, attr, cls)\r\n            return cls\r\n\r\n        raise AttributeError(attr)\r\n\r\n    def __dir__(self):\r\n        return sorted(set(_ModType.__dir__(self)) | set(self._schema_.keys()))\r\n\r\n\r\ndef _gen_mod(mod_name, schema, package):\r\n    trace_types = {cls_name: {\"module\": mod_name, \"trace_type\": cls_name.lower()} for cls_name in schema.get(\"t\", [])}\r\n    mod_schema = {cls_name: {\"module\": mod_name} for cls_name in schema.get(\"a\", [])}\r\n    mod_schema.update(trace_types)\r\n\r\n    mod = _LazyPlotlyMod(mod_name, mod_schema, package)\r\n    _sys.modules[mod_name] = mod\r\n\r\n    for leaf, s in schema.get(\"c\", {}).items():\r\n        package = not leaf.startswith(\"_\")  # private modules are not packages (e.g graph_objs._bar)\r\n        child = _gen_mod(mod_name + \".\" + leaf, s, package)\r\n        if not package:\r\n            child.__package__ = mod.__package__\r\n            mod_schema.update(child._schema_)\r\n        setattr(mod, leaf, child)\r\n\r\n    return mod\r\n\r\n\r\ngraph_objs = _gen_mod(\"plotly.graph_objs\", {\"c\": _root_schema}, True)\r\n\r\n# do this after we've created graph_objs\r\nfrom . import plotly, graph_objects\r\n";Sk.builtinFiles.files['src/lib/plotly/_cls_overrides.py']="# Classes in plotly that have additional behaviour and features\r\n\r\nfrom anvil.util import WrappedObject\r\n\r\n\r\ndef _not_implemented_wrapper(cls_name, name):\r\n    def not_implemented(self, *args, **kws):\r\n        raise NotImplementedError(name + \" is not yet implemented\")\r\n\r\n    not_implemented.__name__ = name\r\n    not_implemented.__qualname__ = cls_name + \".\" + name\r\n\r\n    return not_implemented\r\n\r\n\r\nclass Figure(WrappedObject):\r\n    def __init__(self, data=None, layout=None, **kws):\r\n        if isinstance(data, Figure):\r\n            data, layout = data.data, data.layout\r\n        elif type(data) is dict and (\"data\" in data or \"layout\" in data):\r\n            # Extract data, layout, and frames\r\n            data, layout = (\r\n                data.get(\"data\", None),\r\n                data.get(\"layout\", None),\r\n            )\r\n\r\n        if data is None:\r\n            data = []\r\n        elif not isinstance(data, (list, tuple)):\r\n            data = [data]\r\n\r\n        if layout is None:\r\n            layout = {}\r\n\r\n        WrappedObject.__init__(self, data=data, layout=layout, **kws)\r\n\r\n    # some common methods we don't support\r\n    update_traces = _not_implemented_wrapper(\"Figure\", \"update_traces\")\r\n    add_trace = _not_implemented_wrapper(\"Figure\", \"add_trace\")\r\n    for_each_trace = _not_implemented_wrapper(\"Figure\", \"for_each_trace\")\r\n\r\n    def update_layout(self, dict1=None, **kws):\r\n        dict1 = dict1 or {}\r\n        self.layout.update(dict1, **kws)\r\n        return self\r\n\r\n\r\n_overrides = {\"plotly.graph_objs._figure.Figure\": Figure}\r\n";Sk.builtinFiles.files['src/lib/plotly/_schema.py']="schema={'bar':{'a':['ErrorX','ErrorY','Hoverlabel','Insidetextfont','Legendgrouptitle','Marker','Outsidetextfont','Selected','Stream','Textfont','Transform','Unselected'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['ColorBar','Line','Pattern'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'selected':{'a':['Marker','Textfont']},'unselected':{'a':['Marker','Textfont']}}},'_bar':{'t':['Bar']},'barpolar':{'a':['Hoverlabel','Legendgrouptitle','Marker','Selected','Stream','Transform','Unselected'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['ColorBar','Line','Pattern'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'selected':{'a':['Marker','Textfont']},'unselected':{'a':['Marker','Textfont']}}},'_barpolar':{'t':['Barpolar']},'box':{'a':['Hoverlabel','Legendgrouptitle','Line','Marker','Selected','Stream','Transform','Unselected'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['Line']},'selected':{'a':['Marker']},'unselected':{'a':['Marker']}}},'_box':{'t':['Box']},'candlestick':{'a':['Decreasing','Hoverlabel','Increasing','Legendgrouptitle','Line','Stream','Transform'],'c':{'decreasing':{'a':['Line']},'hoverlabel':{'a':['Font']},'increasing':{'a':['Line']},'legendgrouptitle':{'a':['Font']}}},'_candlestick':{'t':['Candlestick']},'carpet':{'a':['Aaxis','Baxis','Font','Legendgrouptitle','Stream'],'c':{'aaxis':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'baxis':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'legendgrouptitle':{'a':['Font']}}},'_carpet':{'t':['Carpet']},'choropleth':{'a':['ColorBar','Hoverlabel','Legendgrouptitle','Marker','Selected','Stream','Transform','Unselected'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['Line']},'selected':{'a':['Marker']},'unselected':{'a':['Marker']}}},'_choropleth':{'t':['Choropleth']},'choroplethmapbox':{'a':['ColorBar','Hoverlabel','Legendgrouptitle','Marker','Selected','Stream','Transform','Unselected'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['Line']},'selected':{'a':['Marker']},'unselected':{'a':['Marker']}}},'_choroplethmapbox':{'t':['Choroplethmapbox']},'cone':{'a':['ColorBar','Hoverlabel','Legendgrouptitle','Lighting','Lightposition','Stream'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']}}},'_cone':{'t':['Cone']},'contour':{'a':['ColorBar','Contours','Hoverlabel','Legendgrouptitle','Line','Stream','Textfont','Transform'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'contours':{'a':['Impliededits','Labelfont']},'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']}}},'_contour':{'t':['Contour']},'contourcarpet':{'a':['ColorBar','Contours','Legendgrouptitle','Line','Stream'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'contours':{'a':['Impliededits','Labelfont']},'legendgrouptitle':{'a':['Font']}}},'_contourcarpet':{'t':['Contourcarpet']},'densitymapbox':{'a':['ColorBar','Hoverlabel','Legendgrouptitle','Stream','Transform'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']}}},'_densitymapbox':{'t':['Densitymapbox']},'funnel':{'a':['Connector','Hoverlabel','Insidetextfont','Legendgrouptitle','Marker','Outsidetextfont','Stream','Textfont','Transform'],'c':{'connector':{'a':['Line']},'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['ColorBar','Line'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}}}},'_funnel':{'t':['Funnel']},'funnelarea':{'a':['Domain','Hoverlabel','Insidetextfont','Legendgrouptitle','Marker','Stream','Textfont','Title','Transform'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['Line']},'title':{'a':['Font']}}},'_funnelarea':{'t':['Funnelarea']},'heatmap':{'a':['ColorBar','Hoverlabel','Legendgrouptitle','Stream','Textfont','Transform'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']}}},'_heatmap':{'t':['Heatmap']},'heatmapgl':{'a':['ColorBar','Hoverlabel','Legendgrouptitle','Stream','Transform'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']}}},'_heatmapgl':{'t':['Heatmapgl']},'histogram':{'a':['Cumulative','ErrorX','ErrorY','Hoverlabel','Insidetextfont','Legendgrouptitle','Marker','Outsidetextfont','Selected','Stream','Textfont','Transform','Unselected','XBins','YBins'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['ColorBar','Line','Pattern'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'selected':{'a':['Marker','Textfont']},'unselected':{'a':['Marker','Textfont']}}},'_histogram':{'t':['Histogram']},'histogram2d':{'a':['ColorBar','Hoverlabel','Legendgrouptitle','Marker','Stream','Textfont','Transform','XBins','YBins'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']}}},'_histogram2d':{'t':['Histogram2d']},'histogram2dcontour':{'a':['ColorBar','Contours','Hoverlabel','Legendgrouptitle','Line','Marker','Stream','Textfont','Transform','XBins','YBins'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'contours':{'a':['Impliededits','Labelfont']},'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']}}},'_histogram2dcontour':{'t':['Histogram2dContour']},'icicle':{'a':['Domain','Hoverlabel','Insidetextfont','Leaf','Legendgrouptitle','Marker','Outsidetextfont','Pathbar','Root','Stream','Textfont','Tiling','Transform'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['ColorBar','Line'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'pathbar':{'a':['Textfont']}}},'_icicle':{'t':['Icicle']},'image':{'a':['Hoverlabel','Legendgrouptitle','Stream'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']}}},'_image':{'t':['Image']},'indicator':{'a':['Delta','Domain','Gauge','Legendgrouptitle','Number','Stream','Title','Transform'],'c':{'delta':{'a':['Decreasing','Font','Increasing']},'gauge':{'a':['Axis','Bar','Step','Threshold'],'c':{'axis':{'a':['Tickfont','Tickformatstop']},'bar':{'a':['Line']},'step':{'a':['Line']},'threshold':{'a':['Line']}}},'legendgrouptitle':{'a':['Font']},'number':{'a':['Font']},'title':{'a':['Font']}}},'_indicator':{'t':['Indicator']},'isosurface':{'a':['Caps','ColorBar','Contour','Hoverlabel','Legendgrouptitle','Lighting','Lightposition','Slices','Spaceframe','Stream','Surface'],'c':{'caps':{'a':['X','Y','Z']},'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'slices':{'a':['X','Y','Z']}}},'_isosurface':{'t':['Isosurface']},'mesh3d':{'a':['ColorBar','Contour','Hoverlabel','Legendgrouptitle','Lighting','Lightposition','Stream'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']}}},'_mesh3d':{'t':['Mesh3d']},'ohlc':{'a':['Decreasing','Hoverlabel','Increasing','Legendgrouptitle','Line','Stream','Transform'],'c':{'decreasing':{'a':['Line']},'hoverlabel':{'a':['Font']},'increasing':{'a':['Line']},'legendgrouptitle':{'a':['Font']}}},'_ohlc':{'t':['Ohlc']},'parcats':{'a':['Dimension','Domain','Labelfont','Legendgrouptitle','Line','Stream','Tickfont','Transform'],'c':{'legendgrouptitle':{'a':['Font']},'line':{'a':['ColorBar'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}}}},'_parcats':{'t':['Parcats']},'parcoords':{'a':['Dimension','Domain','Labelfont','Legendgrouptitle','Line','Rangefont','Stream','Tickfont','Transform','Unselected'],'c':{'legendgrouptitle':{'a':['Font']},'line':{'a':['ColorBar'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'unselected':{'a':['Line']}}},'_parcoords':{'t':['Parcoords']},'pie':{'a':['Domain','Hoverlabel','Insidetextfont','Legendgrouptitle','Marker','Outsidetextfont','Stream','Textfont','Title','Transform'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['Line']},'title':{'a':['Font']}}},'_pie':{'t':['Pie']},'pointcloud':{'a':['Hoverlabel','Legendgrouptitle','Marker','Stream'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['Border']}}},'_pointcloud':{'t':['Pointcloud']},'sankey':{'a':['Domain','Hoverlabel','Legendgrouptitle','Link','Node','Stream','Textfont'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'link':{'a':['Concentrationscales','Hoverlabel','Line'],'c':{'hoverlabel':{'a':['Font']}}},'node':{'a':['Hoverlabel','Line'],'c':{'hoverlabel':{'a':['Font']}}}}},'_sankey':{'t':['Sankey']},'scatter':{'a':['ErrorX','ErrorY','Fillpattern','Hoverlabel','Legendgrouptitle','Line','Marker','Selected','Stream','Textfont','Transform','Unselected'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['ColorBar','Gradient','Line'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'selected':{'a':['Marker','Textfont']},'unselected':{'a':['Marker','Textfont']}}},'_scatter':{'t':['Scatter']},'scatter3d':{'a':['ErrorX','ErrorY','ErrorZ','Hoverlabel','Legendgrouptitle','Line','Marker','Projection','Stream','Textfont','Transform'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'line':{'a':['ColorBar'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'marker':{'a':['ColorBar','Line'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'projection':{'a':['X','Y','Z']}}},'_scatter3d':{'t':['Scatter3d']},'scattercarpet':{'a':['Hoverlabel','Legendgrouptitle','Line','Marker','Selected','Stream','Textfont','Transform','Unselected'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['ColorBar','Gradient','Line'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'selected':{'a':['Marker','Textfont']},'unselected':{'a':['Marker','Textfont']}}},'_scattercarpet':{'t':['Scattercarpet']},'scattergeo':{'a':['Hoverlabel','Legendgrouptitle','Line','Marker','Selected','Stream','Textfont','Transform','Unselected'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['ColorBar','Gradient','Line'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'selected':{'a':['Marker','Textfont']},'unselected':{'a':['Marker','Textfont']}}},'_scattergeo':{'t':['Scattergeo']},'scattergl':{'a':['ErrorX','ErrorY','Hoverlabel','Legendgrouptitle','Line','Marker','Selected','Stream','Textfont','Transform','Unselected'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['ColorBar','Line'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'selected':{'a':['Marker','Textfont']},'unselected':{'a':['Marker','Textfont']}}},'_scattergl':{'t':['Scattergl']},'scattermapbox':{'a':['Cluster','Hoverlabel','Legendgrouptitle','Line','Marker','Selected','Stream','Textfont','Transform','Unselected'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['ColorBar'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'selected':{'a':['Marker']},'unselected':{'a':['Marker']}}},'_scattermapbox':{'t':['Scattermapbox']},'scatterpolar':{'a':['Hoverlabel','Legendgrouptitle','Line','Marker','Selected','Stream','Textfont','Transform','Unselected'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['ColorBar','Gradient','Line'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'selected':{'a':['Marker','Textfont']},'unselected':{'a':['Marker','Textfont']}}},'_scatterpolar':{'t':['Scatterpolar']},'scatterpolargl':{'a':['Hoverlabel','Legendgrouptitle','Line','Marker','Selected','Stream','Textfont','Transform','Unselected'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['ColorBar','Line'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'selected':{'a':['Marker','Textfont']},'unselected':{'a':['Marker','Textfont']}}},'_scatterpolargl':{'t':['Scatterpolargl']},'scattersmith':{'a':['Hoverlabel','Legendgrouptitle','Line','Marker','Selected','Stream','Textfont','Transform','Unselected'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['ColorBar','Gradient','Line'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'selected':{'a':['Marker','Textfont']},'unselected':{'a':['Marker','Textfont']}}},'_scattersmith':{'t':['Scattersmith']},'scatterternary':{'a':['Hoverlabel','Legendgrouptitle','Line','Marker','Selected','Stream','Textfont','Transform','Unselected'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['ColorBar','Gradient','Line'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'selected':{'a':['Marker','Textfont']},'unselected':{'a':['Marker','Textfont']}}},'_scatterternary':{'t':['Scatterternary']},'splom':{'a':['Diagonal','Dimension','Hoverlabel','Legendgrouptitle','Marker','Selected','Stream','Transform','Unselected'],'c':{'dimension':{'a':['Axis']},'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['ColorBar','Line'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'selected':{'a':['Marker']},'unselected':{'a':['Marker']}}},'_splom':{'t':['Splom']},'streamtube':{'a':['ColorBar','Hoverlabel','Legendgrouptitle','Lighting','Lightposition','Starts','Stream'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']}}},'_streamtube':{'t':['Streamtube']},'sunburst':{'a':['Domain','Hoverlabel','Insidetextfont','Leaf','Legendgrouptitle','Marker','Outsidetextfont','Root','Stream','Textfont','Transform'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['ColorBar','Line'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}}}},'_sunburst':{'t':['Sunburst']},'surface':{'a':['ColorBar','Contours','Hoverlabel','Legendgrouptitle','Lighting','Lightposition','Stream'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'contours':{'a':['X','Y','Z'],'c':{'x':{'a':['Project']},'y':{'a':['Project']},'z':{'a':['Project']}}},'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']}}},'_surface':{'t':['Surface']},'table':{'a':['Cells','Domain','Header','Hoverlabel','Legendgrouptitle','Stream'],'c':{'cells':{'a':['Fill','Font','Line']},'header':{'a':['Fill','Font','Line']},'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']}}},'_table':{'t':['Table']},'treemap':{'a':['Domain','Hoverlabel','Insidetextfont','Legendgrouptitle','Marker','Outsidetextfont','Pathbar','Root','Stream','Textfont','Tiling','Transform'],'c':{'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['ColorBar','Line','Pad'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'pathbar':{'a':['Textfont']}}},'_treemap':{'t':['Treemap']},'violin':{'a':['Box','Hoverlabel','Legendgrouptitle','Line','Marker','Meanline','Selected','Stream','Transform','Unselected'],'c':{'box':{'a':['Line']},'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'marker':{'a':['Line']},'selected':{'a':['Marker']},'unselected':{'a':['Marker']}}},'_violin':{'t':['Violin']},'volume':{'a':['Caps','ColorBar','Contour','Hoverlabel','Legendgrouptitle','Lighting','Lightposition','Slices','Spaceframe','Stream','Surface'],'c':{'caps':{'a':['X','Y','Z']},'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'hoverlabel':{'a':['Font']},'legendgrouptitle':{'a':['Font']},'slices':{'a':['X','Y','Z']}}},'_volume':{'t':['Volume']},'waterfall':{'a':['Connector','Decreasing','Hoverlabel','Increasing','Insidetextfont','Legendgrouptitle','Outsidetextfont','Stream','Textfont','Totals','Transform'],'c':{'connector':{'a':['Line']},'decreasing':{'a':['Marker'],'c':{'marker':{'a':['Line']}}},'hoverlabel':{'a':['Font']},'increasing':{'a':['Marker'],'c':{'marker':{'a':['Line']}}},'legendgrouptitle':{'a':['Font']},'totals':{'a':['Marker'],'c':{'marker':{'a':['Line']}}}}},'_waterfall':{'t':['Waterfall']},'layout':{'a':['Activeselection','Activeshape','Annotation','Coloraxis','Colorscale','Font','Geo','Grid','Hoverlabel','Image','Legend','Mapbox','Margin','Modebar','Newselection','Newshape','Polar','Scene','Selection','Shape','Slider','Smith','Ternary','Title','Transition','Uniformtext','Updatemenu','XAxis','YAxis'],'c':{'annotation':{'a':['Font','Hoverlabel'],'c':{'hoverlabel':{'a':['Font']}}},'coloraxis':{'a':['ColorBar'],'c':{'colorbar':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'geo':{'a':['Center','Domain','Lataxis','Lonaxis','Projection'],'c':{'projection':{'a':['Rotation']}}},'grid':{'a':['Domain']},'hoverlabel':{'a':['Font','Grouptitlefont']},'legend':{'a':['Font','Grouptitlefont','Title'],'c':{'title':{'a':['Font']}}},'mapbox':{'a':['Bounds','Center','Domain','Layer'],'c':{'layer':{'a':['Circle','Fill','Line','Symbol'],'c':{'symbol':{'a':['Textfont']}}}}},'newselection':{'a':['Line']},'newshape':{'a':['Line']},'polar':{'a':['AngularAxis','Domain','RadialAxis'],'c':{'angularaxis':{'a':['Tickfont','Tickformatstop']},'radialaxis':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'scene':{'a':['Annotation','Aspectratio','Camera','Domain','XAxis','YAxis','ZAxis'],'c':{'annotation':{'a':['Font','Hoverlabel'],'c':{'hoverlabel':{'a':['Font']}}},'aspectratio':{'a':['Impliededits']},'camera':{'a':['Center','Eye','Projection','Up']},'xaxis':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'yaxis':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'zaxis':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'selection':{'a':['Line']},'shape':{'a':['Line']},'slider':{'a':['Currentvalue','Font','Pad','Step','Transition'],'c':{'currentvalue':{'a':['Font']}}},'smith':{'a':['Domain','Imaginaryaxis','Realaxis'],'c':{'imaginaryaxis':{'a':['Tickfont']},'realaxis':{'a':['Tickfont']}}},'ternary':{'a':['Aaxis','Baxis','Caxis','Domain'],'c':{'aaxis':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'baxis':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}},'caxis':{'a':['Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'title':{'a':['Font','Pad']},'updatemenu':{'a':['Button','Font','Pad']},'xaxis':{'a':['Minor','Rangebreak','Rangeselector','Rangeslider','Tickfont','Tickformatstop','Title'],'c':{'rangeselector':{'a':['Button','Font']},'rangeslider':{'a':['YAxis']},'title':{'a':['Font']}}},'yaxis':{'a':['Minor','Rangebreak','Tickfont','Tickformatstop','Title'],'c':{'title':{'a':['Font']}}}}},'_layout':{'a':['Layout']},'_deprecations':{'a':['Data','Annotations','Frames','AngularAxis','Annotation','ColorBar','Contours','ErrorX','ErrorY','ErrorZ','Font','Legend','Line','Margin','Marker','RadialAxis','Scene','Stream','XAxis','YAxis','ZAxis','XBins','YBins','Trace','Histogram2dcontour']},'_figure':{'a':['Figure']}}";Sk.builtinFiles.files['src/lib/plotly/graph_objects.py']="from .graph_objs import *";Sk.builtinFiles.files['src/lib/plotly/plotly.py']="\ndef _mk_unimplemented(name):\n    def f(*args, **kwargs):\n        raise Exception(\"You don't need %s() on Anvil. Set the 'data' property on a Plot component instead\" % name)\n    return f\n\niplot = _mk_unimplemented(\"iplot\")\nplot = _mk_unimplemented(\"plot\")\n";